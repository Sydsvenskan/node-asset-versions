// @ts-check

'use strict';

import foo from './modules/bundled-module';
import bar from './modules/chunked-module';

/** @param {string} text */
const print = (text) => {
  document.documentElement.appendChild(document.createTextNode(text));
  document.documentElement.appendChild(document.createElement('br'));
};

print(foo());
print(bar());

Promise.resolve()
  .then(async () => {
    const { lazy } = await import(/* webpackChunkName: 'lazy' */ './modules/lazy-module');
    print(lazy());
  }).catch(err => {
    // eslint-disable-next-line no-console
    console.error('Failed:', err);
  });
