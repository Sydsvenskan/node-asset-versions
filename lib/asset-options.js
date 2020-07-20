// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const loadJsonFile = require('load-json-file');

const { resolveJsonStringArray } = require('./misc');

/**
 * @typedef AssetsOptions
 * @property {string[]} files
 * @property {string[]} webpackManifest
 * @property {string} sourceDir
 * @property {string} targetDir
 */

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
