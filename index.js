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
  silentSyncLoadJsonFile
} = require('./lib/misc');

const {
  loadWebpackVersions
} = require('./lib/webpack');

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

  _loadAssetDefinitions () {
    const { definitionsPath } = this;
    const { files, sourceDir, webpackManifest } = loadJsonFile.sync(definitionsPath);

    const definitionDir = pathModule.dirname(definitionsPath);
    const resolvedSourceDir = pathModule.resolve(definitionDir, sourceDir);

    const versionsPath = pathModule.resolve(definitionDir, this.versionsFileName);

    /** @type {Map<string, string>} */
    const result = new Map();
    const webpackVersions = webpackManifest ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

    const versions = resolveJsonObject(this.useVersionedPaths && silentSyncLoadJsonFile(versionsPath), 'asset versions file');
    const fileVersions = resolveJsonStringValueObject(versions.files, 'versions.files');
    const fileDependencies = resolveJsonObject(versions.dependencies, 'versions.dependencies');

    /** @type {Map<string, string[]>} */
    const dependencies = new Map();
    const allFiles = new Set([
      ...files,
      ...Object.keys(fileVersions),
      ...Object.keys(webpackVersions)
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

      const webpackFileRaw = webpackVersions[file];

      /** @type {string|undefined} */
      let webpackFile;

      if (typeof webpackFileRaw === 'string') {
        webpackFile = webpackFileRaw;
      } else if (typeof webpackFileRaw === 'object') {
        webpackFile = webpackFileRaw.path;
      }

      const resolvedTargetFilePath = webpackFile
        ? pathModule.resolve(resolvedSourceDir, webpackFile)
        : resolvedFilePath;
        /** @type {string} */
      const relativeTargetFilePath = fileVersions[file] || pathModule.relative(definitionDir, resolvedTargetFilePath);

      result.set(relativeFilePath, relativeTargetFilePath);

      const versionsSiblings = fileDependencies[file] ? resolveJsonStringArray(fileDependencies[file], 'versions.dependencies') : undefined;
      /** @type {string[]} */
      const siblings = versionsSiblings || (webpackVersions[file] || {}).siblings || [];

      try {
        const dependencyPaths = siblings.map(sibling => processFilePaths(sibling).relativeFilePath);
        dependencies.set(relativeFilePath, dependencyPaths);
      } catch (err) {
        throw new VError(err, `Failed to resolve siblings for ${file}`);
      }
    }

    this.definitions = result;
    this.dependencies = dependencies;
  }

  /**
   * Get the versioned asset path for a file
   *
   * @param {string} file The non-versioned name of a versioned file
   * @returns {string}
   */
  getAssetPath (file) {
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

module.exports = AssetVersions;
