// @ts-check
/// <reference types="node" />

'use strict';

/** @typedef {import('webpack').compilation.Chunk} Chunk */
/** @typedef {import('webpack-manifest-plugin').FileDescriptor} FileDescriptor */
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
  const manifest = (seed || {});

  /** @type {string[]} Built list of files affected in this set of files */
  const manifestFiles = [];

  for (const { name, chunk, path } of files) {
    if (!name) {
      continue;
    }
    // List this file as "tracked" being part of this manifest
    manifestFiles.push(name);

    const chunkGroups = chunk?.groupsIterable ?? [];
    const isMap = (/** @type {string} */ name) => name.slice(-4) === `.map`;

    if (manifest[name]) {
      if (!manifest[name].siblings) {
        manifest[name].siblings = isMap(name) ? undefined : [];
      }
      // Path might have change, e.g. watching files.
      manifest[name].path = path;
    } else {
      manifest[name] = {
        path,
        siblings: isMap(name) ? undefined : []
      };
    }

    for (const chunkGroup of chunkGroups) {
      const files = [];

      for (const chunk of chunkGroup.chunks) {
        files.push(...chunk.files);
      }

      for (const filename of files) {
        // Ignore maps and the current file when it comes to finding siblings:
        if (!isMap(name) && filename !== path && !isMap(filename)) {
          const siblings = manifest[name].siblings;
          if (Array.isArray(siblings)) {
            siblings.push(filename);
          }
        }
      }
    }
  }

  for (const key of manifestFiles) {
    const item = manifest[key];

    if (Array.isArray(item.siblings)) {
      // Replace siblings files (incl. hash) with list of resolved file name (sans hash)
      item.siblings = item.siblings.map(sibling => {
        return manifestFiles.find(matchKey => {
          return manifest[matchKey]?.path?.endsWith(sibling);
        }) || '';
      }).filter(item => Boolean(item));
    }
  }

  return manifest;
};

module.exports = webpackManifestPluginGenerate;
