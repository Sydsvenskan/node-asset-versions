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
 * @returns {import('type-fest').JsonValue|undefined}
 */
const silentSyncLoadJsonFile = (path) => {
  try {
    return loadJsonFile.sync(path);
  } catch (err) {
    // It's okay for it not to exist
  }
};

/**
 * @param {import('type-fest').JsonValue|undefined} data
 * @param {string} label
 * @returns {string[]}
 */
const resolveJsonStringArray = (data, label) => {
  if (!data) return [];
  if (typeof data === 'string') return [data];

  /** @type {string[]} */
  const result = [];

  if (!Array.isArray(data)) {
    throw new TypeError(`Expected a ${label} array, instead got: ${typeof data}`);
  }

  for (const value of data) {
    if (typeof value !== 'string') {
      throw new TypeError(`Expected ${label} array to only contain strings, encountered a:  ${typeof value}`);
    }
    result.push(value);
  }

  return result;
};

/**
 * @param {import('type-fest').JsonValue|undefined} data
 * @param {string} label
 * @returns {import('type-fest').JsonObject|undefined}
 */
const resolveJsonObject = (data, label) => {
  if (!data) return;

  if (typeof data !== 'object') {
    throw new TypeError(`Expected a ${label} object, instead got: ${typeof data}`);
  }
  if (Array.isArray(data)) {
    throw new TypeError(`Expected a ${label} non-array object, instead got: ${typeof data}`);
  }

  return data;
};

/**
 * @param {import('type-fest').JsonValue|undefined} data
 * @param {string} label
 * @returns {{ [key: string]: string }}
 */
const resolveJsonStringValueObject = (data, label) => {
  if (!data) return {};

  const jsonObject = resolveJsonObject(data, label);

  if (!jsonObject) return {};

  /** @type {{ [key: string]: string }} */
  const result = {};

  for (const key of Object.keys(jsonObject)) {
    const value = jsonObject[key];
    if (typeof value !== 'string') {
      throw new TypeError(`Expected ${label} object to only contain strings, encountered a:  ${typeof value}`);
    }
    result[key] = value;
  }

  return result;
};

/**
 * @param {import('type-fest').JsonValue|undefined} data
 * @param {string} label
 * @returns {{ [key: string]: string[] }}
 */
const resolveJsonStringArrayValueObject = (data, label) => {
  if (!data) return {};

  const jsonObject = resolveJsonObject(data, label);

  if (!jsonObject) return {};

  /** @type {{ [key: string]: string[] }} */
  const result = {};

  for (const key of Object.keys(jsonObject)) {
    result[key] = resolveJsonStringArray(jsonObject[key], label);
  }

  return result;
};

module.exports = {
  ensurePrefix,
  resolveJsonStringArray,
  resolveJsonObject,
  resolveJsonStringValueObject,
  resolveJsonStringArrayValueObject,
  silentSyncLoadJsonFile
};
