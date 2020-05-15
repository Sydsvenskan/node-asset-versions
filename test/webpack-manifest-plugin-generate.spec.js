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
});
