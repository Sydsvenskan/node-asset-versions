#!/usr/bin/env node
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
    help: 'Folder of assets.json path',
    helpArg: 'PATH'
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
const assetsOptions = require(pathModule.resolve(workingDir, 'assets.json'));

const { files, sourceDir, targetDir } = assetsOptions;

objectPromiseAll(files.reduce((result, file) => {
  const resolvedSourceDir = pathModule.resolve(workingDir, sourceDir);
  const sourcePath = pathModule.resolve(sourceDir, file);

  result[file] = revFile(sourcePath)
    .then(target => {
      const targetFile = pathModule.relative(resolvedSourceDir, target);
      const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

      return cpFile(sourcePath, targetPath)
        .then(() => pathModule.relative(process.cwd(), targetPath));
    });

  return result;
}, {}))
  .then(files => writeJsonFile(pathModule.resolve(workingDir, 'asset-versions.json'), { files }))
  .catch(err => setImmediate(() => { throw err; }));
