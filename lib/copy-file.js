// @ts-check
/// <reference types="node" />

'use strict';

const pathModule = require('path');

const cpFile = require('cp-file');
const revFile = require('rev-file');
const VError = require('verror');

/**
 * @param {string} file
 * @param {{ dependencies: { [file: string]: string[]|undefined }, copiedFiles: { [file: string]: string } }} resultCollector
 * @param {{ resolvedSourceDir: string, workingDir: string, targetDir: string, webpackFiles: import('./webpack').AssetVersionsWebpackManifest, debug: import('debug').Debugger }} context
 * @returns {Promise<void>}
 */
const resolveAndCopyFile = async (file, { dependencies, copiedFiles }, { resolvedSourceDir, workingDir, targetDir, webpackFiles, debug }) => {
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

  await Promise.resolve(webpackRevvedSourcePath || revFile(sourcePath))
    .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to rev file'); })
    .then(async target => {
      const targetFile = pathModule.relative(resolvedSourceDir, target);
      const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

      await cpFile(webpackRevvedSourcePath || sourcePath, targetPath);

      copiedFiles[file] = pathModule.relative(workingDir, targetPath);
    })
    .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to copy file'); });
};

module.exports = { resolveAndCopyFile };
