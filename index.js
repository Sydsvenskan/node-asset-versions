// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const loadJsonFile = require('load-json-file');
const VError = require('verror');

const {
  ensurePrefix,
  silentSyncLoadJsonFile
} = require('./utils/misc');

const {
  loadWebpackVersions
} = require('./utils/webpack');

/**
 * @typedef {object} AssetVersionsOptions
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

    const result = {};
    const webpackVersions = webpackManifest ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

    const versions = this.useVersionedPaths ? silentSyncLoadJsonFile(versionsPath) : {};
    const fileVersions = ((versions || {}).files || {});
    const dependencies = {};
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
      const relativeTargetFilePath = fileVersions[file] || pathModule.relative(definitionDir, resolvedTargetFilePath);

      result[relativeFilePath] = relativeTargetFilePath;

      /** @type {string[]} */
      const siblings = ((versions || {}).dependencies || {})[file] || (webpackVersions[file] || {}).siblings || [];

      try {
        dependencies[relativeFilePath] = siblings.map(sibling => processFilePaths(sibling).relativeFilePath);
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
    const definition = this.definitions && this.definitions[file];

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
    const assetPaths = ((this.dependencies || {})[file] || [])
      .concat(file)
      .map(asset => ensurePrefix('/', this.getAssetPath(asset)));

    return assetPaths;
  }
}

/**
 * @param {object} baseAppInstance
 * @param {AssetVersionsOptions} [options]
 * @returns {{ pluginName: 'AssetVersions', main: AssetVersions }}
 */
AssetVersions.baseAppPlugin = function (baseAppInstance, options) {
  options = Object.assign({
    assetDefinitions: require('pkg-dir').sync(__dirname) + '/assets.json',
    useVersionedPaths: baseAppInstance.getConfig().env !== 'development'
  }, options || {});

  return {
    pluginName: 'AssetVersions',
    main: new AssetVersions(options)
  };
};

AssetVersions.webpackManifestPluginGenerate = require('./utils/manifest-generator');

module.exports = AssetVersions;
