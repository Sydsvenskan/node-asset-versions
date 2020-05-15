/* eslint-disable no-console */
// @ts-check
/// <reference types="node" />

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const { escape } = require('html-escaper');

const AssetVersions = require('..');

const assets = new AssetVersions({
  assetDefinitions: path.resolve(__dirname, 'assets.json'),
});

const assetContent = new Map();

// eslint-disable-next-line security/detect-non-literal-require
const { files } = require(path.resolve(__dirname, 'asset-versions.json'));

for (const file in files) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  assetContent.set('/' + files[file], fs.readFileSync(path.resolve(__dirname, files[file])));
}

const server = http.createServer((req, res) => {
  if (assetContent.has(req.url)) {
    console.log('Serving asset:', req.url);

    res.write(assetContent.get(req.url));
  } else if (req.url === '/') {
    console.log('Serving root page');

    const css = assets.getAssetPath('dist/bare/main.css');
    const js = assets.getAssetPathWithDependencies('dist/bare/main.js');

    res.setHeader('Content-Type', 'text/html');
    res.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><link href="${escape(css)}" rel="stylesheet" /></head><body>`);
    for (const file of js) {
      res.write(`<script src="${escape(file)}"></script>`);
    }
    res.write(`</body>`);
  } else {
    console.log('Did not find:', req.url);

    res.writeHead(404);
    res.write('Not found');
  }

  res.end();
});
server.on('clientError', (err, socket) => {
  console.error('Client Error:', err);
  socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
server.listen(8000, () => {
  console.log('Started on port 8000');
});
