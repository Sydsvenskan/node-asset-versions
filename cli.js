#!/usr/bin/env node

// @ts-check
/// <reference types="node" />

'use strict';

const debug = require('debug')('asset-versions');
const dashdash = require('dashdash');

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
    help: 'Include source-map entries when adding WebPack files',
    'default': false
  }
];

const parser = dashdash.createParser({ options });

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

const includeSourceMaps = opts.source_maps;

delete opts._args;

const pathModule = require('path');

const cpFile = require('cp-file');
const revFile = require('rev-file');
const loadJsonFile = require('load-json-file');
const writeJsonFile = require('write-json-file');
const VError = require('verror');

const { objectPromiseAll } = require('@hdsydsvenskan/utils');

const { loadWebpackVersions } = require('./utils/webpack');

const workingDir = opts.path || process.cwd();
const outputFile = pathModule.resolve(workingDir, opts.output);
/** @type {Object<string,any>} */
const assetsOptions = loadJsonFile.sync(pathModule.resolve(workingDir, 'assets.json'));

const { files, sourceDir, targetDir, webpackManifest } = assetsOptions;

const dependencies = {};

const resolvedSourceDir = pathModule.resolve(workingDir, sourceDir);
const webpackFiles = webpackManifest ? loadWebpackVersions(resolvedSourceDir, webpackManifest) : {};

debug('working dir: %s', workingDir);
debug('resolved source dir: %s', resolvedSourceDir);

// Add all webpack files as well
Object.keys(webpackFiles).forEach(file => {
  if (!files.includes(file) && !(file.endsWith('.map') && !includeSourceMaps)) {
    files.push(file);
  }
});

objectPromiseAll(files.reduce((result, file) => {
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

  result[file] = Promise.resolve(webpackRevvedSourcePath || revFile(sourcePath))
    .catch(err => { throw new VError(err, 'Failed to rev file'); })
    .then(async target => {
      const targetFile = pathModule.relative(resolvedSourceDir, target);
      const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

      await cpFile(webpackRevvedSourcePath || sourcePath, targetPath);

      return pathModule.relative(workingDir, targetPath);
    })
    .catch(err => { throw new VError(err, 'Failed to copy file'); });

  return result;
}, {}))
  // @ts-ignore
  .then(files => writeJsonFile(outputFile, { files, dependencies }))
  .catch(err => {
    // eslint-disable-next-line no-console
    console.error('Encountered an error:', err.stack);
    process.exit(1);
  });
