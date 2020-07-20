#!/usr/bin/env node

// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const cpFile = require('cp-file');
const debug = require('debug')('asset-versions');
const dashdash = require('dashdash');
const loadJsonFile = require('load-json-file');
const revFile = require('rev-file');
const VError = require('verror');
const writeJsonFile = require('write-json-file');

// *** CLI setup ***

const options = [
  {
    names: ['help', 'h'],
    type: 'bool',
    help: 'Print this help and exit.'
  },
  {
    names: ['verbose', 'v'],
    type: 'bool',
    help: 'Shows warnings and notices.'
  },
  {
    names: ['path', 'p'],
    type: 'string',
    completionType: 'file',
    env: 'HDS_ASSETS_VERSIONING_PATH',
    help: 'Resolve paths against this path rather than current working directory',
    helpArg: 'PATH'
  },
  {
    names: ['output', 'o'],
    type: 'string',
    completionType: 'file',
    help: 'Name of output file',
    helpArg: 'FILE',
    'default': 'asset-versions.json'
  }
];

const parser = dashdash.createParser({ options });

/**
 * @typedef CommandLineOptions
 * @property {boolean} [help]
 * @property {string} [output]
 * @property {string} [path]
 * @property {string[]} [_args]
 */

/** @type {CommandLineOptions} */
let opts;

try {
  opts = parser.parse(process.argv);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error('Error:', err.message);
  process.exit(1);
}

if (opts.help) {
  // @ts-ignore
  const help = parser.help().trimEnd();
  // eslint-disable-next-line no-console
  console.log(
    '\n' +
    'Usage: asset-versions\n\n' +
    'Options:\n' +
    help
  );
  process.exit(0);
}

delete opts._args;

// *** Tool setup ***

const { loadWebpackVersions } = require('./utils/webpack');

const workingDir = opts.path || process.cwd();
const outputFile = pathModule.resolve(workingDir, opts.output);

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

loadAssetsOptions(workingDir).then(async ({ files, sourceDir, targetDir, webpackManifest }) => {
  /** @type {{ [file: string]: string[]|undefined }} */
  const dependencies = {};
  /** @type {{ [file: string]: string }} */
  const copiedFiles = {};

  const resolvedSourceDir = pathModule.resolve(workingDir, sourceDir);
  const webpackFiles = webpackManifest.length !== 0 ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

  debug('working dir: %s', workingDir);
  debug('resolved source dir: %s', resolvedSourceDir);

  // Add all webpack files as well
  Object.keys(webpackFiles).forEach(file => {
    if (!file.endsWith('.map') && !files.includes(file)) {
      files.push(file);
    }
  });

  await Promise.all(files.map(async (file) => {
    const sourcePath = pathModule.resolve(resolvedSourceDir, file);
    const webpackFileRaw = webpackFiles[file];

    debug('file "%s" has source path: %s', file, sourcePath);

    /** @type {string|undefined} */
    let webpackFile;
    /** @type {string[]|undefined} */
    let webpackFileSiblings;

    if (typeof webpackFileRaw === 'string') {
      webpackFile = webpackFileRaw;
    } else if (typeof webpackFileRaw === 'object') {
      webpackFile = webpackFileRaw.path;
      webpackFileSiblings = webpackFileRaw.siblings;
    }

    // Has WebPack revved this for us already? Use that file then
    const webpackRevvedSourcePath = webpackFile
      ? pathModule.resolve(resolvedSourceDir, webpackFile)
      : undefined;

    debug('file "%s" has webpack path: %s', file, webpackRevvedSourcePath);

    dependencies[file] = webpackFileSiblings;
    // Ensures a consistent order, assigns a string to stick to the type
    copiedFiles[file] = '';

    return Promise.resolve(webpackRevvedSourcePath || revFile(sourcePath))
      .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to rev file'); })
      .then(async target => {
        const targetFile = pathModule.relative(resolvedSourceDir, target);
        const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

        await cpFile(webpackRevvedSourcePath || sourcePath, targetPath);

        copiedFiles[file] = pathModule.relative(workingDir, targetPath);
      })
      .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to copy file'); });
  }));

  await writeJsonFile(outputFile, {
    files: copiedFiles,
    dependencies
  });
})
  .catch(/** @param {Error} err */ err => {
    // eslint-disable-next-line no-console
    console.error('Encountered an error:', err.stack);
    process.exit(1);
  });
