# Asset Versions

CLI and helper methods for asset versioning. Includes support for Webpack chunking.

## Installation

```bash
npm install --save-dev @hdsydsvenskan/asset-versions
```

## Release new version

Follow [Semantic Versioning](http://semver.org/) and use [np](https://www.npmjs.com/package/np) and a version like `patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3`

```bash
np patch
```

## Example

See a full example, including Webpack support, in [example/](./example) folder and/or run the `start` npm script (run `yarn start` / `npm start`).

## Usage

### Generate asset version through CLI

1. Add an `assets.json`
2. Run `asset-versions`
3. Get an `assets-versioned.json` file

### Programmaticly access versioned paths

```javascript
const AssetVersions = require('@hdsydsvenskan/asset-versions');

const assets = new AssetVersions({
  assetDefinitions: __dirname + '/assets.json'
});

// Returns something like 'assets/rev/main-e508b3af03.css'
assets.getAssetPath('assets/main.css');
```

Or, in case of code splitted javascript (likely through the use of Webpack):

```javascript
// Returns something like ['assets/rev/main-e508b3af03.js', 'assets/rev/vendor-abc123.js']
assets.getAssetPathWithDependencies('assets/main.js');
```

### Configure asset versions

Create a `assets.json` file:

```json
{
  "sourceDir": "assets",
  "targetDir": "assets/rev/",
  "files": [
    "main.css",
    "main-dev.css",
    "main.js"
  ]
}
```

## Configuration options

* **versions file name** – both the cli (through the `--output`/ `-o` flag) and the module (through the `versionsFileName` option) can be tweaked to use another versions file than the default `asset-versions.json`

## Extras

* *AssetVersions.webpackManifestPluginGenerate* – a `generate` method for use with [webpack-manifest-plugin](https://www.npmjs.com/package/webpack-manifest-plugin) to generate manifest with dependencies
