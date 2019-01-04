// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');
const urlModule = require('url');

/**
 * @typedef {object} AssetVersionsOptions
 * @property {string} assetDefinitions
 * @property {boolean} [useVersionedPaths=true]
 * @property {string} [versionsFileName='asset-versions.json']
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
    const { files, sourceDir, webpackManifest } = require(definitionsPath);

    const definitionDir = pathModule.dirname(definitionsPath);
    const resolvedSourceDir = pathModule.resolve(definitionDir, sourceDir);

    const versionsPath = pathModule.resolve(definitionDir, this.versionsFileName);
    const webpackManifestPath = webpackManifest ? pathModule.resolve(resolvedSourceDir, webpackManifest) : undefined;

    const result = {};

    let versions = {};
    let webpackVersions = {};

    if (this.useVersionedPaths) {
      try {
        versions = require(versionsPath);
      } catch (err) {
        // It's okay for it not to exist
      }
    }

    if (webpackManifestPath) {
      try {
        webpackVersions = require(webpackManifestPath);
      } catch (err) {
        // It's okay for it not to exist
      }
    }

    const fileVersions = (versions.files || {});

    (files || []).forEach(file => {
      const resolvedFilePath = pathModule.resolve(resolvedSourceDir, file);
      const relativeFilePath = pathModule.relative(definitionDir, resolvedFilePath);

      const resolvedTargetFilePath = webpackVersions[file]
        ? pathModule.resolve(resolvedSourceDir, webpackVersions[file])
        : resolvedFilePath;
      const relativeTargetFilePath = fileVersions[file] || pathModule.relative(definitionDir, resolvedTargetFilePath);

      result[relativeFilePath] = relativeTargetFilePath;
    });

    this.definitions = result;
  }

  /**
   * Get the versioned asset path for a file
   *
   * @param {string} file The non-versioned name of a versioned file
   */
  getAssetPath (file) {
    const definition = this.definitions[file];

    if (!definition) {
      throw new Error(`Asset definition "${file}" not found`);
    }

    return urlModule.resolve('/', definition);
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

module.exports = AssetVersions;
