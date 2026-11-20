// Shared helpers: load the dashboard data, serve the site locally, open a browser.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const PAGES = ['index.html', 'council.html', 'statements.html', 'method.html'];
const DATA_NAMES = ['COUNCILS', 'STATEMENTS', 'QUOTES', 'POOL'];

const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
const sha = (value) => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// The logic script embedded in a page (the part the runtime evaluates).
function pageScript(file) {
  const m = read(file).match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  return m ? m[1] : '';
}

// Evaluate a script and return the named top-level constants it defines.
function constantsFrom(source) {
  const names = [...source.matchAll(/^const ([A-Z_]+) = /gm)].map((m) => m[1]).filter((n) => DATA_NAMES.includes(n));
  if (!names.length) return {};
  const ctx = {};
  vm.runInNewContext(source + '\n;this.__out = {' + names.join(',') + '};', ctx);
  return JSON.parse(JSON.stringify(ctx.__out));
}

// Data a page defines inline in its own logic script (before the class).
const inlineData = (file) => constantsFrom(pageScript(file).split(/\nclass Component/)[0]);

// Local scripts a page loads from the data folder, in order.
const dataScripts = (file) => [...read(file).matchAll(/<script src="\.\/(data\/[^"]+)"><\/script>/g)].map((m) => m[1]);

// Everything a page can see: shared data files it loads plus anything inline.
function dataFor(file) {
  const out = {};
  for (const src of dataScripts(file)) Object.assign(out, constantsFrom(read(src)));
  return Object.assign(out, inlineData(file));
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.json': 'application/json' };

// Serve the repository root the way GitHub Pages serves the site.
function startServer() {
  const server = http.createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ base: 'http://127.0.0.1:' + server.address().port + '/', close: () => new Promise((r) => server.close(r)) })));
}

async function launch() {
  const { chromium } = require('playwright');
  return chromium.launch();
}

// Compare a value with a stored baseline file, or rewrite the file when UPDATE_BASELINE=1.
function baseline(name, current) {
  const file = path.join(__dirname, 'baseline', name);
  if (process.env.UPDATE_BASELINE === '1' || !fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(current, null, 1) + '\n');
    return { stored: current, written: true };
  }
  return { stored: JSON.parse(fs.readFileSync(file, 'utf8')), written: false };
}

module.exports = { ROOT, PAGES, read, sha, slug, pageScript, inlineData, dataScripts, dataFor, startServer, launch, baseline };
