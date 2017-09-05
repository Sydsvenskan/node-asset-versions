# Asset Versions

CLI and helper methods for our asset versions

## Requirements

Requires at least Node.js 6.x

## Installation

```bash
npm install --save-dev @hdsydsvenskan/asset-versions
```

## Release new version

Follow [Semantic Versioning](http://semver.org/) and use [np](https://www.npmjs.com/package/np) and a version like `patch | minor | major | prepatch | preminor | premajor | prerelease | 1.2.3`

```bash
np patch
```

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
