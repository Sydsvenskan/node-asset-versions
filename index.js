'use strict';

const pathModule = require('path');
const urlModule = require('url');

class AssetVersions {
  constructor (options) {
    options = options || {};

    if (!options.assetDefinitions) { throw new Error('assetDefinitions option is required'); }

    this.definitionsPath = options.assetDefinitions;
    this.useVersionedPaths = options.useVersionedPaths !== false;
    this.versionsFileName = options.versionsFileName || 'asset-versions.json';

    this.loadAssetDefinitions();
  }

  loadAssetDefinitions () {
    const { definitionsPath } = this;
    const definitionDir = pathModule.dirname(definitionsPath);
    const versionsPath = pathModule.resolve(definitionDir, this.versionsFileName);

    const result = {};

    const { files, sourceDir } = require(definitionsPath);

    let versions = {};

    if (this.useVersionedPaths) {
      try {
        versions = require(versionsPath);
      } catch (err) {
        // It's okay for it not to work
      }
    }

    const fileVersions = (versions.files || []);
    const resolvedSourceDir = pathModule.resolve(definitionDir, sourceDir);

    (files || []).forEach(file => {
      const resolvedFilePath = pathModule.resolve(resolvedSourceDir, file);
      const relativeFilePath = pathModule.relative(definitionDir, resolvedFilePath);

      result[relativeFilePath] = fileVersions[file] || relativeFilePath;
    });

    this.definitions = result;
  }

  getAssetPath (file) {
    const definition = this.definitions[file];

    if (!definition) {
      throw new Error(`Asset definition "${file}" not found`);
    }

    return urlModule.resolve('/', definition);
  }
}

module.exports = AssetVersions;
