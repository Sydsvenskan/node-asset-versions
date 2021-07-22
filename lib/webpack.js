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

    if (typeof path !== 'string') {
      throw new TypeError(`Unexpected webpack manifest item path, expected a string, got a: ${typeof path}`);
    }

    manifest[file] = {
      path,
      siblings: resolveJsonStringArray(siblings, 'webpack manifest item'),
    };
  }

  return manifest;
};

/**
 * Grabs a list of entry points, their versioned files and
 * sibling-files (dependencies) across one or more webpack manifests,
 * and returns a combined object where the versioned file path is the key, and
 * sibling references are pointing to their versioned paths.
 *
 * @param {string} resolvedSourceDir
 * @param {string|string[]} webpackManifests
 * @returns {AssetVersionsCombinedWebpackManifests}
 */
const loadWebpackVersions = (resolvedSourceDir, webpackManifests) => {
  /** @type {AssetVersionsCombinedWebpackManifests} */
  const webpackVersions = {};

  for (const webpackManifestFile of [webpackManifests].flat()) {
    const webpackManifestPath = pathModule.resolve(resolvedSourceDir, webpackManifestFile);
    const manifest = loadWebpackManifest(webpackManifestPath);

    if (!manifest) continue;

    for (const file in manifest) {
      const { path, siblings } = manifest[file];

      if (webpackVersions[path]) {
        throw new Error(`Same path encountered multiple times, this should not happen? Path: ${path}`);
      }

      webpackVersions[path] = {
        filename: file,
        // Make the siblings reference the versioned file names
        siblings: siblings ? siblings.map(filename => manifest[filename].path) : undefined,
      };

      // If the name of the file is already found as a handled file path:
      if (webpackVersions[file]) {
        const aliasArray = webpackVersions[file];
        // ...and that file already has an array of file paths:
        if (Array.isArray(aliasArray)) {
          // ...add this path to the array:
          aliasArray.push(path);
        }
      } else {
        // Create an "alias" of the file name,
        // containing the file path as an array.
        webpackVersions[file] = [path];
      }
    }
  }

  return webpackVersions;
};

module.exports = {
  loadWebpackVersions
};
