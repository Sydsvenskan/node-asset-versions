// @ts-check
/// <reference types="node" />

'use strict';

/** @typedef {import('webpack').compilation.Chunk} Chunk */
/** @typedef {import('webpack-manifest-plugin').Chunk} ManifestChunk */
/** @typedef {Omit<import('webpack-manifest-plugin').FileDescriptor, 'chunk'> & { chunk?: ManifestChunk | Chunk }} FileDescriptor */
/** @typedef {{ [filename: string]: {path: string, siblings?: string[]} }} AssetVersionsWebpackManifest */

/**
 * For use with https://github.com/danethurber/webpack-manifest-plugin
 *
 * Inspired by https://github.com/gatsbyjs/gatsby/blob/52c13f633533729b4f737d459ea52c39f40ccf33/packages/gatsby/src/utils/webpack.config.js#L211-L251
 * and https://github.com/danethurber/webpack-manifest-plugin/issues/181#issuecomment-445277384
 *
 * @param {object|AssetVersionsWebpackManifest} seed
 * @param {FileDescriptor[]} files
 * @returns {AssetVersionsWebpackManifest}
 */
const webpackManifestPluginGenerate = (seed, files) => {
  /** @type {AssetVersionsWebpackManifest} */
  const manifest = Object.assign({}, seed);

  for (const { name, chunk, path } of files) {
    if (!name || !chunk || !chunk.groupsIterable) {
      continue;
    }

    const chunkGroups = chunk.groupsIterable;
    const isMap = name.slice(-4) === `.map`;

    manifest[name] = {
      path,
      siblings: isMap ? undefined : []
    };

    for (const chunkGroup of chunkGroups) {
      const files = [];

      for (const chunk of chunkGroup.chunks) {
        files.push(...chunk.files);
      }

      for (const filename of files) {
        if (!isMap && filename !== path && filename.slice(-4) !== `.map`) {
          const siblings = manifest[name].siblings;
          if (siblings) siblings.push(filename);
        }
      }
    }
  }

  const manifestFiles = Object.keys(manifest);

  for (const key of manifestFiles) {
    const item = manifest[key];

    if (item.siblings) {
      /** @type {string[]} */
      const resolvedSiblings = [];

      for (const sibling of item.siblings) {
        const matchingFile = manifestFiles.find(matchKey => manifest[matchKey].path.endsWith(sibling));
        if (matchingFile !== undefined) resolvedSiblings.push(matchingFile);
      }

      item.siblings = resolvedSiblings;
    }
  }

  return manifest;
};

module.exports = webpackManifestPluginGenerate;
