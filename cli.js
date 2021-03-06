#!/usr/bin/env node

// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const debug = require('debug')('asset-versions');
const dashdash = require('dashdash');

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
  },
  {
    names: ['source-maps', 's'],
    type: 'bool',
    help: 'Include source-map entries when adding Webpack files',
    'default': false
  }
];

const parser = dashdash.createParser({ options });

/**
 * @typedef CommandLineOptions
 * @property {boolean} [help]
 * @property {string} [output]
 * @property {string} [path]
 * @property {boolean} [source_maps]
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

const includeSourceMaps = opts.source_maps;
const workingDir = opts.path || process.cwd();
const outputFile = opts.output && pathModule.resolve(workingDir, opts.output);

// *** Tool setup ***

const { loadAssetsOptions } = require('./lib/asset-options');
const { resolveAndCopyFile } = require('./lib/copy-file');
const { loadWebpackVersions } = require('./lib/webpack');
const { ASSET_VERSIONS_FILE_VERSION } = require('.');

/** @typedef {import('./index').AssetVersionsFileDefinition} AssetVersionsFileDefinition */

loadAssetsOptions(workingDir).then(async ({ files, sourceDir, targetDir, webpackManifest }) => {
  /** @type {AssetVersionsFileDefinition["dependencies"]} */
  const dependencies = {};
  /** @type {AssetVersionsFileDefinition["files"]} */
  const copiedFiles = {};

  const resolvedSourceDir = pathModule.resolve(workingDir, sourceDir);
  const webpackFiles = webpackManifest.length !== 0 ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

  debug('working dir: %s', workingDir);
  debug('resolved source dir: %s', resolvedSourceDir);

  // Add all webpack files as well
  Object.keys(webpackFiles).forEach(file => {
    if (!files.includes(file) && !(file.endsWith('.map') && !includeSourceMaps)) {
      files.push(file);
    }
  });

  // Copy files and resolve dependencies
  await Promise.all(files.map(file => resolveAndCopyFile(
    file,
    { dependencies, copiedFiles },
    { resolvedSourceDir, workingDir, targetDir, webpackFiles, debug }
  )));

  /** @type {AssetVersionsFileDefinition} */
  const definition = {
    version: ASSET_VERSIONS_FILE_VERSION,
    files: copiedFiles,
    dependencies,
  };

  if (!outputFile) {
    throw new Error('Output file name missing somehow. Aborting.');
  }

  await writeJsonFile(outputFile, definition);
})
  .catch(/** @param {Error} err */ err => {
    // eslint-disable-next-line no-console
    console.error('Encountered an error:', err.stack);
    process.exit(1);
  });
