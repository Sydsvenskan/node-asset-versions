// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const {
  silentSyncLoadJsonFile
} = require('./misc');

/**
 * @param {string} resolvedSourceDir
 * @param {string|string[]} webpackManifests
 * @returns {Object<string,any>}
 */
const loadWebpackVersions = (resolvedSourceDir, webpackManifests) => {
  let webpackVersions = {};

  for (const manifest of [].concat(webpackManifests)) {
    const webpackManifestPath = pathModule.resolve(resolvedSourceDir, manifest);
    const result = silentSyncLoadJsonFile(webpackManifestPath);

    webpackVersions = Object.assign(webpackVersions, result);
  }

  return webpackVersions;
};

module.exports = {
  loadWebpackVersions
};
