// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const loadJsonFile = require('load-json-file');

/**
 * @typedef AssetsOptions
 * @property {string[]} files
 * @property {string[]} webpackManifest
 * @property {string} sourceDir
 * @property {string} targetDir
 */

/**
 * @param {any} data
 * @param {string} label
 * @returns {string[]}
 */
const resolveJsonStringArray = (data, label) => {
  if (!data) return [];
  if (typeof data === 'string') return [data];

  /** @type {string[]} */
  const resolvedArray = [];

  if (!Array.isArray(data)) {
    throw new TypeError(`Expected a ${label} array, instead got: ${typeof data}`);
  }

  for (const value of data) {
    if (typeof value !== 'string') {
      throw new TypeError(`Expected ${label} array to only contain strings, encountered a:  ${typeof value}`);
    }
    resolvedArray.push(value);
  }

  return resolvedArray;
};

/**
 * @param {string} workingDir
 * @returns {Promise<AssetsOptions>}
 */
const loadAssetsOptions = async (workingDir) => {
  const { files, webpackManifest, sourceDir, targetDir } = await loadJsonFile(pathModule.resolve(workingDir, 'assets.json'));

  if (!sourceDir || typeof sourceDir !== 'string') throw new TypeError('Expected a non-empty string sourceDir');
  if (!targetDir || typeof targetDir !== 'string') throw new TypeError('Expected a non-empty string targetDir');

  return {
    files: resolveJsonStringArray(files, 'files'),
    webpackManifest: resolveJsonStringArray(webpackManifest, 'webpackManifest'),
    sourceDir,
    targetDir,
  };
};

module.exports = { loadAssetsOptions };
