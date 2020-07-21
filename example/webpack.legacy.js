// @ts-check
/// <reference types="node" />

'use strict';

const path = require('path');

const webpack = require('webpack');

const ManifestPlugin = require('webpack-manifest-plugin');

const { webpackManifestPluginGenerate } = require('..');

const assetsPath = path.resolve(__dirname, 'dist/bare');

module.exports = {
  entry: {
    legacy: path.resolve(__dirname, 'src/js/legacy.js'),
  },
  stats: true,
  output: {
    path: assetsPath,
    globalObject: 'self',
    filename: '[name].[contenthash].js'
  },
  optimization: {
    usedExports: true
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /@babel\/|core-js/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              [
                '@babel/preset-env',
                {
                  corejs: 3,
                  // Lets be crazy
                  targets: 'firefox >=20',
                  useBuiltIns: 'entry'
                }
              ]
            ]
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.HashedModuleIdsPlugin(),
    new ManifestPlugin({
      fileName: 'manifest-legacy.json',
      publicPath: '',
      generate: webpackManifestPluginGenerate
    })
  ]
};
