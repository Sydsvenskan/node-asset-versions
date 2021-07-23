// @ts-check

'use strict';

const chai = require('chai');

const should = chai.should();

const {
  webpackManifestPluginGenerate,
} = require('..');

describe('webpackManifestPluginGenerate()', () => {
  it('should handle passthrough case', () => {
    const result = webpackManifestPluginGenerate({
      foo: { path: '123' }
    }, []);

    should.exist(result);

    result.should.deep.equal({
      foo: { path: '123' }
    });
  });

  it('should update path when seed already contains entry (watch/multi-compiler)', function () {
    // Represents already built file per "foo" entry
    const seed = {
      'myfile.js': { path: 'myfile.123.js' }
    };
    // New build affecting same file, but with new path for "foo"
    const files = [
      {
        chunk: {
          groupsIterable: []
        },
        path: 'myfile.234.js',
        name: 'myfile.js',
      }
    ];
    // @ts-ignore due to not acutally using the FileDescriptor signaruture
    const result = webpackManifestPluginGenerate(seed, files);
    result.should.deep.equal({
      'myfile.js': { path: 'myfile.234.js', siblings: [] }
    });
  });
});
