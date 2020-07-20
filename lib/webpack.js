// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const {
  resolveJsonObject,
  silentSyncLoadJsonFile
} = require('./misc');

/** @typedef {import('./manifest-generator').AssetVersionsWebpackManifest} AssetVersionsWebpackManifest */

/**
 * @param {string} resolvedSourceDir
 * @param {string|string[]} webpackManifests
 * @returns {AssetVersionsWebpackManifest}
 */
const loadWebpackVersions = (resolvedSourceDir, webpackManifests) => {
  /** @type {AssetVersionsWebpackManifest} */
  let webpackVersions = {};

  for (const manifest of Array.isArray(webpackManifests) ? webpackManifests : [webpackManifests]) {
    const webpackManifestPath = pathModule.resolve(resolvedSourceDir, manifest);
    const rawResult = silentSyncLoadJsonFile(webpackManifestPath);
    if (rawResult) {
      /** @type {AssetVersionsWebpackManifest|undefined}  */
      const result = resolveJsonObject(rawResult, 'webpack manifest');

      webpackVersions = Object.assign(webpackVersions, result);
    }
  }

  return webpackVersions;
};

module.exports = {
  loadWebpackVersions
};
