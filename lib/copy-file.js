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
 * @param {{ resolvedSourceDir: string, workingDir: string, targetDir: string, webpackFiles: import('./webpack').AssetVersionsCombinedWebpackManifests, debug: import('debug').Debugger }} context
 * @returns {Promise<void>}
 */
const resolveAndCopyFile = async (file, { dependencies, copiedFiles }, { resolvedSourceDir, workingDir, targetDir, webpackFiles, debug }) => {
  const webpackDefinition = webpackFiles[file];

  if (Array.isArray(webpackDefinition)) {
    // This is an alias collection, we don't need to care about that now
    return;
  }

  // This is either a webpack defined file or an actual file
  const sourcePath = pathModule.resolve(resolvedSourceDir, file);

  if (webpackDefinition) {
    debug('file "%s" has webpack path: %s', webpackDefinition.filename, sourcePath);
  } else {
    debug('file "%s" has source path: %s', file, sourcePath);
  }

  const siblings = (webpackDefinition && webpackDefinition.siblings) || [];

  dependencies[file] = siblings.length ? siblings : undefined;
  // Ensures a consistent order, assigns a string to stick to the type
  copiedFiles[file] = '';

  await Promise.resolve(webpackDefinition ? sourcePath : revFile(sourcePath))
    .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to rev file'); })
    .then(async target => {
      const targetFile = pathModule.relative(resolvedSourceDir, target);
      const targetPath = pathModule.resolve(workingDir, targetDir, targetFile);

      await cpFile(sourcePath, targetPath);

      copiedFiles[file] = pathModule.relative(workingDir, targetPath);
    })
    .catch(/** @param {Error} err */ err => { throw new VError(err, 'Failed to copy file'); });
};

module.exports = { resolveAndCopyFile };
