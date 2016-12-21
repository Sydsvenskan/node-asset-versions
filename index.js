'use strict';

const pathModule = require('path');

class AssetVersions {
  constructor (options) {
    options = options || {};

    if (!options.assetDefinitions) { throw new Error('assetDefinitions option is required'); }

    this.definitionsPath = options.assetsDefinition;

    this.loadAssetDefinitions();
  }

  loadAssetDefinitions () {
    const { definitionsPath } = this;
    const definitionDir = pathModule.dirname(definitionsPath);
    const versionsPath = pathModule.resolve(definitionDir, 'asset-versions.json');

    const result = {};

    const { files, sourceDir } = require(definitionsPath);

    let versions;

    try {
      versions = require(versionsPath);
    } catch (err) {
      versions = {};
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
      throw new Error('Asset definition not found');
    }

    return definition;
  }
}

module.exports = AssetVersions;
