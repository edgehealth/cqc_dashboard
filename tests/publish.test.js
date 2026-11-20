// Checks that everything the pages load is actually published by the deploy workflow.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, PAGES, read } = require('./helpers');

test('the workflow publishes every local file the pages reference', () => {
  const workflow = read('.github/workflows/static.yml');
  const copied = workflow.match(/cp -r (.+) _site\//)[1].split(/\s+/);
  const published = (rel) => copied.some((c) => (c === '*.html' ? /^[^/]+\.html$/.test(rel) : rel === c || rel.startsWith(c + '/')));
  for (const p of PAGES) {
    assert.ok(published(p), p + ' is not published');
    for (const m of read(p).matchAll(/(?:src|href)="\.\/([^"#?]+)"/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, m[1])), p + ' references missing file ' + m[1]);
      assert.ok(published(m[1]), p + ' references ' + m[1] + ', which the workflow does not publish');
    }
  }
  for (const m of read('assets/fonts.css').matchAll(/url\(([^)]+)\)/g)) assert.ok(fs.existsSync(path.join(ROOT, 'assets', m[1])), 'missing font ' + m[1]);
});

test('pages make no external requests for scripts, styles or fonts', () => {
  for (const p of PAGES) {
    const head = read(p).split('<script type="text/x-dc"')[0];
    assert.deepEqual([...head.matchAll(/<(?:script|link)[^>]+(?:src|href)="(https?:\/\/[^"]+)"[^>]*>/g)].map((m) => m[0]).filter((tag) => !/rel="canonical"/.test(tag)), [], p);
  }
});
