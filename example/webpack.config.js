// @ts-check
/// <reference types="node" />

'use strict';

const path = require('path');

const webpack = require('webpack');

const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const ManifestPlugin = require('webpack-manifest-plugin');

const { webpackManifestPluginGenerate } = require('..');

const assetsPath = path.resolve(__dirname, 'dist/bare');

module.exports = {
  entry: {
    main: path.resolve(__dirname, 'src/js/main.js'),
  },
  stats: true,
  output: {
    path: assetsPath,
    globalObject: 'self',
    filename: '[name].[contenthash].js'
  },
  optimization: {
    usedExports: true,
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: 5,
      minSize: 1, // For example purposes only, never set this to 0 in production
      cacheGroups: {
        internal: {
          test: /chunked/,
          priority: 10,
          name: 'internal'
        },
        'default': {
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true
        }
      }
    }
  },
  plugins: [
    new CleanWebpackPlugin({ cleanOnceBeforeBuildPatterns: ['*.js', '*.js.map'] }),
    new webpack.HashedModuleIdsPlugin(),
    new ManifestPlugin({
      publicPath: '',
      generate: webpackManifestPluginGenerate
    })
  ]
};
