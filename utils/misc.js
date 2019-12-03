// @ts-check
/// <reference types="node" />

'use strict';

const loadJsonFile = require('load-json-file');

/**
 * @param {string} prefix
 * @param {string} value
 * @returns {string}
 */
const ensurePrefix = (prefix, value) => (value[0] === prefix ? '' : prefix) + value;

/**
 * @param {string} path
 * @returns {any}
 */
const silentSyncLoadJsonFile = (path) => {
  try {
    return loadJsonFile.sync(path);
  } catch (err) {
    // It's okay for it not to exist
  }
};

module.exports = {
  ensurePrefix,
  silentSyncLoadJsonFile
};
