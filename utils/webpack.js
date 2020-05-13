// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const {
  silentSyncLoadJsonFile
} = require('./misc');

/** @typedef {import('..').AssetVersionsWebpackManifest} AssetVersionsWebpackManifest */

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
    /** @type {AssetVersionsWebpackManifest|undefined}  */
    const result = silentSyncLoadJsonFile(webpackManifestPath);

    webpackVersions = Object.assign(webpackVersions, result);
  }

  return webpackVersions;
};

module.exports = {
  loadWebpackVersions
};
