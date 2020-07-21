// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const {
  resolveJsonObject,
  resolveJsonStringArray,
  silentSyncLoadJsonFile
} = require('./misc');

/** @typedef {{ [file: string]: string[]|{filename: string, siblings?: string[]} }} AssetVersionsCombinedWebpackManifests */

/**
 * @param {string} webpackManifestPath
 * @returns {import('./manifest-generator').AssetVersionsWebpackManifest|undefined}
 */
const loadWebpackManifest = (webpackManifestPath) => {
  const rawResult = resolveJsonObject(silentSyncLoadJsonFile(webpackManifestPath), 'webpack manifest');
  if (!rawResult) return;

  /** @type {import('./manifest-generator').AssetVersionsWebpackManifest}  */
  const manifest = {};

  for (const file in rawResult) {
    const value = resolveJsonObject(rawResult[file], 'webpack manifest item');

    if (!value) throw new TypeError('Unexpected empty webpack manifest item');

    const { path, siblings } = value;

    if (typeof path !== 'string') throw new TypeError(`Unexpected webpack manifest item path, expected a string, got a: ${typeof path}`);

    manifest[file] = {
      path,
      siblings: resolveJsonStringArray(siblings, 'webpack manifest item'),
    };
  }

  return manifest;
};

/**
 * @param {string} resolvedSourceDir
 * @param {string|string[]} webpackManifests
 * @returns {AssetVersionsCombinedWebpackManifests}
 */
const loadWebpackVersions = (resolvedSourceDir, webpackManifests) => {
  /** @type {AssetVersionsCombinedWebpackManifests} */
  const webpackVersions = {};

  for (const webpackManifestFile of Array.isArray(webpackManifests) ? webpackManifests : [webpackManifests]) {
    const webpackManifestPath = pathModule.resolve(resolvedSourceDir, webpackManifestFile);
    const manifest = loadWebpackManifest(webpackManifestPath);

    if (!manifest) continue;

    for (const file in manifest) {
      const { path, siblings } = manifest[file];

      if (webpackVersions[path]) throw new Error(`Same path encountered multiple times, this should not happen? Path: ${path}`);

      webpackVersions[path] = {
        filename: file,
        // Make the siblings reference the versioned file names
        siblings: siblings ? siblings.map(filename => manifest[filename].path) : undefined,
      };

      if (webpackVersions[file]) {
        const aliasArray = webpackVersions[file];
        if (Array.isArray(aliasArray)) {
          aliasArray.push(path);
        }
      } else {
        webpackVersions[file] = [path];
      }
    }
  }

  return webpackVersions;
};

module.exports = {
  loadWebpackVersions
};
