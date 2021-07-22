// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const loadJsonFile = require('load-json-file');
const VError = require('verror');

const {
  ensurePrefix,
  resolveJsonStringArray,
  resolveJsonObject,
  resolveJsonStringValueObject,
  resolveJsonStringArrayValueObject,
  silentSyncLoadJsonFile
} = require('./lib/misc');

const {
  loadWebpackVersions
} = require('./lib/webpack');

/** @typedef {2} AssetVersionsFileDefinitionVersion */

/** @type {AssetVersionsFileDefinitionVersion} */
const ASSET_VERSIONS_FILE_VERSION = 2;

/**
 * @typedef AssetVersionsFileDefinition
 * @property {ASSET_VERSIONS_FILE_VERSION} version
 * @property {{ [file: string]: string[]|undefined }} dependencies
 * @property {{ [file: string]: string }} files
 */

/**
 * @typedef AssetVersionsOptions
 * @property {string} assetDefinitions - Path to the asset manifest you have created
 * @property {boolean} [useVersionedPaths=true] - If set to false then the original, non-versioned, files will be used
 * @property {string} [versionsFileName='asset-versions.json'] - Path to the file containing the data about the generated versions
 */

class AssetVersions {
  /**
   * @param {AssetVersionsOptions} options
   */
  constructor ({ assetDefinitions, useVersionedPaths, versionsFileName }) {
    if (!assetDefinitions || typeof assetDefinitions !== 'string') { throw new TypeError('Expected a non-empty assetDefinitions string'); }
    if (versionsFileName && typeof versionsFileName !== 'string') { throw new TypeError('Expected versionsFileName to be a string'); }

    this.definitionsPath = assetDefinitions;
    this.useVersionedPaths = useVersionedPaths !== false;
    this.versionsFileName = versionsFileName || 'asset-versions.json';

    this._loadAssetDefinitions();
  }

  /**
   * Loads the generated asset versions file and returns the versioned
   * files and dependencies found therein.
   * If versioned paths are not desired, this will return empty dummy objects.
   *
   * @param {string} definitionDir
   * @returns {Omit<AssetVersionsFileDefinition, 'version'>}
   */
  _loadVersionedPaths (definitionDir) {
    if (!this.useVersionedPaths) return { files: {}, dependencies: {} };

    const versionsPath = pathModule.resolve(definitionDir, this.versionsFileName);

    const rawVersions = resolveJsonObject(this.useVersionedPaths && silentSyncLoadJsonFile(versionsPath), 'asset versions file');

    if (rawVersions && (typeof rawVersions.version !== 'number' || rawVersions.version !== ASSET_VERSIONS_FILE_VERSION)) {
      throw new Error(`Unexpected definition version in asset versions file. Expected ${ASSET_VERSIONS_FILE_VERSION}, found ${rawVersions.version}`);
    }

    const files = rawVersions ? resolveJsonStringValueObject(rawVersions.files, 'versions.files') : {};

    const dependencies = rawVersions ? resolveJsonStringArrayValueObject(rawVersions.dependencies, 'versions.dependencies') : {};

    return { files, dependencies };
  }

  /**
   * Loads:
   * 1. List of settings and desired file names
   * 2. List of versioned files and their dependencies
   * 3. Manifests created by webpack-manifest-plugin
   *    and the versioned files found therein
   */
  _loadAssetDefinitions () {
    const { definitionsPath } = this;

    // Loads the file defining assets names and settings (webpack manifests etc)
    const { files, sourceDir, webpackManifest } = loadJsonFile.sync(definitionsPath);

    const definitionDir = pathModule.dirname(definitionsPath);
    const resolvedSourceDir = pathModule.resolve(definitionDir, sourceDir);

    // Grab the generated lits of versioned files and their dependencies:
    const {
      files: fileVersions,
      dependencies: fileDependencies,
    } = this._loadVersionedPaths(definitionDir);
    const webpackFiles = webpackManifest ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

    /** @type {Set<string>} */
    const hasMultipleTargets = new Set();
    /** @type {Map<string, string>} */
    const definitions = new Map();
    /** @type {Map<string, string[]>} */
    const dependencies = new Map();

    /** @type {Set<string>} */
    const allFiles = new Set([
      ...files,
      ...Object.keys(fileVersions),
      ...Object.keys(webpackFiles)
    ]);

    /**
     * @param {string} file
     * @returns {{ resolvedFilePath: string, relativeFilePath: string }}
     */
    const processFilePaths = (file) => {
      if (!file || typeof file !== 'string') {
        throw new TypeError(`Expected file to be a non-empty string, got ${file}`);
      }
      const resolvedFilePath = pathModule.resolve(resolvedSourceDir, file);
      const relativeFilePath = pathModule.relative(definitionDir, resolvedFilePath);
      return { resolvedFilePath, relativeFilePath };
    };

    for (const file of allFiles) {
      const { resolvedFilePath, relativeFilePath } = processFilePaths(file);

      // This section is to do with some form of reference between
      // recurring file names in the webpack manifest, and a way to resolve them.
      // Messy, but seems to work.
      const webpackDefinition = webpackFiles[file];
      const webpackAliasTarget = Array.isArray(webpackDefinition)
        ? webpackDefinition[0]
        : undefined;
      const webpackAliasTargetDefinition = webpackAliasTarget
        ? webpackFiles[webpackAliasTarget]
        : undefined;

      if (webpackAliasTargetDefinition && Array.isArray(webpackAliasTargetDefinition)) {
        throw new Error('A list of aliases pointing to a list of aliases? That is weird and should not be possible');
      }
      if (Array.isArray(webpackDefinition) && webpackDefinition.length > 1) {
        hasMultipleTargets.add(relativeFilePath);
      }

      const resolvedTargetFilePath = webpackAliasTarget
        ? pathModule.resolve(resolvedSourceDir, webpackAliasTarget)
        : resolvedFilePath;

      const targetFile = webpackAliasTarget || file;
      // – end of messy bit.

      /** @type {string} */
      const relativeTargetFilePath = (
        fileVersions[targetFile] ||
        pathModule.relative(definitionDir, resolvedTargetFilePath)
      );

      definitions.set(relativeFilePath, relativeTargetFilePath);

      const versionsSiblings = fileDependencies[targetFile]
        ? resolveJsonStringArray(fileDependencies[targetFile], 'versions.dependencies')
        : undefined;
      const siblings = (
        versionsSiblings ||
        (webpackAliasTargetDefinition && webpackAliasTargetDefinition.siblings) ||
        []
      );

      try {
        const dependencyPaths = siblings.map(sibling => processFilePaths(sibling).relativeFilePath);
        dependencies.set(relativeFilePath, dependencyPaths);
      } catch (err) {
        throw new VError(err, `Failed to resolve siblings for ${file}`);
      }
    }

    this.hasMultipleTargets = hasMultipleTargets;
    this.definitions = definitions;
    this.dependencies = dependencies;
  }

  /**
   * Get the versioned asset path for a file
   *
   * @param {string} file The non-versioned name of a versioned file
   * @returns {string}
   */
  getAssetPath (file) {
    if (this.hasMultipleTargets && this.hasMultipleTargets.has(file)) {
      throw new Error(`Asset definition "${file}" is an alias with many possible targets. Impossible to resolve.`);
    }

    const definition = this.definitions && this.definitions.get(file);

    if (!definition) {
      throw new Error(`Asset definition "${file}" not found`);
    }

    return ensurePrefix('/', definition);
  }

  /**
   * Get the versioned asset path for a file + all of its dependencies
   *
   * @param {string} file The non-versioned name of a versioned file
   * @returns {string[]}
   */
  getAssetPathWithDependencies (file) {
    const dependencies = (this.dependencies && this.dependencies.get(file)) || [];
    const assetPaths = dependencies
      .concat(file)
      .map(asset => ensurePrefix('/', this.getAssetPath(asset)));

    return assetPaths;
  }
}

/**
 * Internal plugin definition for @Sydsvenskan
 *
 * @param {object} baseAppInstance
 * @param {AssetVersionsOptions} [options]
 * @returns {{ pluginName: 'AssetVersions', main: AssetVersions }}
 */
AssetVersions.baseAppPlugin = function (baseAppInstance, options) {
  options = Object.assign({
    assetDefinitions: require('pkg-dir').sync(__dirname) + '/assets.json',
    // @ts-ignore
    useVersionedPaths: baseAppInstance.getConfig().env !== 'development'
  }, options || {});

  return {
    pluginName: 'AssetVersions',
    main: new AssetVersions(options)
  };
};

AssetVersions.webpackManifestPluginGenerate = require('./lib/manifest-generator');
AssetVersions.ASSET_VERSIONS_FILE_VERSION = ASSET_VERSIONS_FILE_VERSION;

module.exports = AssetVersions;
