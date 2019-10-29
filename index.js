// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');
const urlModule = require('url');

const VError = require('verror');

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
    const dependencies = {};
    const allFiles = [].concat(files);

    if (versions && versions.files) {
      Object.keys(versions.files).forEach(file => {
        if (!allFiles.includes(file)) {
          allFiles.push(file);
        }
      });
    }

    if (webpackVersions) {
      Object.keys(webpackVersions).forEach(file => {
        if (!allFiles.includes(file)) {
          allFiles.push(file);
        }
      });
    }

    const processFilePaths = (file) => {
      if (!file || typeof file !== 'string') {
        throw new TypeError(`Expected file to be a non-empty string, got ${file}`);
      }
      const resolvedFilePath = pathModule.resolve(resolvedSourceDir, file);
      const relativeFilePath = pathModule.relative(definitionDir, resolvedFilePath);
      return { resolvedFilePath, relativeFilePath };
    };

    allFiles.forEach(file => {
      const { resolvedFilePath, relativeFilePath } = processFilePaths(file);

      const webpackFile = webpackVersions[file]
        ? (webpackVersions[file].path || webpackVersions[file])
        : undefined;

      const resolvedTargetFilePath = webpackFile
        ? pathModule.resolve(resolvedSourceDir, webpackFile)
        : resolvedFilePath;
      const relativeTargetFilePath = fileVersions[file] || pathModule.relative(definitionDir, resolvedTargetFilePath);

      result[relativeFilePath] = relativeTargetFilePath;

      const siblings = (versions.dependencies || {})[file] || (webpackVersions[file] || {}).siblings || [];

      try {
        dependencies[relativeFilePath] = siblings.map(sibling => processFilePaths(sibling).relativeFilePath);
      } catch (err) {
        throw new VError(err, `Failed to resolve siblings for ${file}`);
      }
    });

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
    const definition = this.definitions[file];

    if (!definition) {
      throw new Error(`Asset definition "${file}" not found`);
    }

    return urlModule.resolve('/', definition);
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
      .map(asset => urlModule.resolve('/', this.getAssetPath(asset)));

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

/** @typedef {Object<string,{path: string, siblings?: string[]}>} AssetVersionsWebpackManifest */

/**
 * For use with https://github.com/danethurber/webpack-manifest-plugin
 *
 * Inspired by https://github.com/gatsbyjs/gatsby/blob/52c13f633533729b4f737d459ea52c39f40ccf33/packages/gatsby/src/utils/webpack.config.js#L211-L251
 * and https://github.com/danethurber/webpack-manifest-plugin/issues/181#issuecomment-445277384
 *
 * @param {Object<string,any>} seed
 * @param {Object<string,any>[]} files
 * @returns {AssetVersionsWebpackManifest}
 */
AssetVersions.webpackManifestPluginGenerate = (seed, files) => {
  /** @type {AssetVersionsWebpackManifest} */
  const manifest = Object.assign({}, seed);

  files.forEach((file) => {
    if (!file.chunk || !file.chunk.groupsIterable) {
      return;
    }

    const chunkGroups = file.chunk.groupsIterable;
    const isMap = file.name.slice(-4) === `.map`;

    manifest[file.name] = {
      path: file.path,
      siblings: isMap ? undefined : []
    };

    for (const chunkGroup of chunkGroups) {
      if (!chunkGroup.name) {
        continue;
      }

      const files = [];

      for (const chunk of chunkGroup.chunks) {
        files.push(...chunk.files);
      }

      files.forEach(filename => {
        if (!isMap && filename !== file.path && filename.slice(-4) !== `.map`) {
          manifest[file.name].siblings.push(filename);
        }
      });
    }
  });

  const manifestFiles = Object.keys(manifest);

  manifestFiles.forEach(key => {
    const item = manifest[key];
    item.siblings = item.siblings ? item.siblings.map(sibling => {
      const matchingFile = manifestFiles.find(matchKey => manifest[matchKey].path.endsWith(sibling));

      return matchingFile;
    }) : undefined;
  });

  return manifest;
};

module.exports = AssetVersions;
