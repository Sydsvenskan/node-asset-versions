#!/usr/bin/env node

// @ts-check
/// <reference types="node" />

'use strict';

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
  }
];

const parser = dashdash.createParser({ options });

let opts;

try {
  opts = parser.parse(process.argv);
} catch (err) {
  console.error('Error:', err.message);
  process.exit(1);
}

if (opts.help) {
  // @ts-ignore
  const help = parser.help().trimRight();
  console.log(
    '\n' +
    'Usage: asset-versions\n\n' +
    'Options:\n' +
    help
  );
  process.exit(0);
}

delete opts._args;

const pathModule = require('path');

const cpFile = require('cp-file');
const revFile = require('rev-file');
const writeJsonFile = require('write-json-file');

const { objectPromiseAll } = require('@hdsydsvenskan/utils');

const workingDir = opts.path || process.cwd();
const outputFile = pathModule.resolve(workingDir, opts.output);
const assetsOptions = require(pathModule.resolve(workingDir, 'assets.json'));

const { files, sourceDir, targetDir, webpackManifest } = assetsOptions;

const dependencies = {};

const resolvedSourceDir = pathModule.resolve(workingDir, sourceDir);
const webpackFiles = webpackManifest
  ? require(pathModule.resolve(resolvedSourceDir, webpackManifest))
  : {};

// Add all webpack files as well
Object.keys(webpackFiles).forEach(file => {
  if (!file.endsWith('.map') && !files.includes(file)) {
    files.push(file);
  }
});

objectPromiseAll(files.reduce((result, file) => {
  const sourcePath = pathModule.resolve(sourceDir, file);
  const webpackFile = webpackFiles[file];

  // Has WebPack revved this for us already? Use that file then
  const webpackRevvedSourcePath = webpackFile
    ? pathModule.resolve(sourceDir, webpackFile.path || webpackFile)
    : undefined;

  dependencies[file] = webpackFile ? webpackFile.siblings : undefined;

  result[file] = Promise.resolve(webpackRevvedSourcePath || revFile(sourcePath))
    .then(target => {
      const targetFile = pathModule.relative(resolvedSourceDir, target);
      const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

      return cpFile(webpackRevvedSourcePath || sourcePath, targetPath)
        .then(() => pathModule.relative(process.cwd(), targetPath));
    });

  return result;
}, {}))
  // @ts-ignore
  .then(files => writeJsonFile(outputFile, { files, dependencies }))
  .catch(err => setImmediate(() => { throw err; }));
