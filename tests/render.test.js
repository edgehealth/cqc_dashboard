// Renders every state of every page in a real browser and compares what is on
// screen with a stored baseline. Any change to data loading or page logic that
// alters what a visitor sees shows up here.
//
// States covered: all 9 regions on the overview; every council x every quality
// statement on the council profile; every statement x area filter x region on
// the statements page (plus the fully expanded list); the method page.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, launch, baseline } = require('./helpers');

// Runs inside the page. Walks through every state and returns a fingerprint of each.
async function capture(kind) {
  const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const hash = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
  const root = () => document.querySelector('#dc-root');
  // Template bookkeeping attributes are not visible and may be renumbered; ignore them.
  const snapshot = () => root().innerHTML.replace(/ data-dc-[a-z-]+="[^"]*"/g, '').replace(/<!--[\s\S]*?-->/g, '') + '|' + [...document.querySelectorAll('select')].map((s) => s.value).join(',');
  const until = async (ok, what) => { for (let i = 0; i < 200; i++) { if (ok()) return; await tick(); } throw new Error('timed out waiting for ' + what); };
  const states = {};
  const record = async (key) => { await tick(); states[key] = await hash(snapshot()); };
  await until(() => root() && root().innerText.length > 300 && !root().innerText.includes('{{'), 'first render');
  const text = root().innerText;
  await record('default');

  if (kind === 'overview') {
    const buttons = () => [...document.querySelectorAll('[aria-label="Region"] button')];
    for (let i = 0; i < buttons().length; i++) { const b = buttons()[i]; const label = b.textContent; b.click(); await until(() => buttons()[i].getAttribute('aria-pressed') === 'true', label); await record(label); }
  }

  if (kind === 'council') {
    const slug = (x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const names = [...document.querySelectorAll('#council-select option')].map((o) => o.value);
    const buttons = () => [...document.querySelectorAll('[aria-labelledby="area-h"] button, [aria-labelledby="str-h"] button')];
    for (const name of names) {
      location.hash = slug(name);
      await until(() => document.querySelector('h1').textContent === name, name);
      await record(name + ' | default | ' + document.title);
      if (buttons().length !== 9) throw new Error(name + ' has ' + buttons().length + ' statement buttons');
      for (let i = 0; i < 9; i++) { const b = buttons()[i]; const label = b.textContent; b.click(); await until(() => buttons()[i].getAttribute('aria-pressed') === 'true', name + ' ' + label); await record(name + ' | ' + label); }
    }
  }

  if (kind === 'statements') {
    const tabs = () => [...document.querySelectorAll('nav[aria-label="Quality statements"] button')];
    const filters = () => [...document.querySelectorAll('[aria-label="Filter by area"] button')];
    const region = () => document.querySelector('#region-filter');
    const more = () => [...document.querySelectorAll('button')].find((b) => b.textContent === 'Show more examples');
    const setRegion = async (value) => { const s = region(); s.value = value; s.dispatchEvent(new Event('change', { bubbles: true })); await tick(); };
    for (let t = 0; t < tabs().length; t++) {
      const tab = tabs()[t].textContent; tabs()[t].click();
      await until(() => tabs()[t].getAttribute('aria-pressed') === 'true', tab);
      await record(tab + ' | ' + document.title);
      for (let f = 0; f < filters().length; f++) {
        const filter = filters()[f].textContent; filters()[f].click();
        await until(() => filters()[f].getAttribute('aria-pressed') === 'true', tab + ' ' + filter);
        for (const value of [...region().options].map((o) => o.value)) { await setRegion(value); await record(tab + ' | ' + filter + ' | ' + value); }
        await setRegion('All regions');
        for (let n = 0; n < 40 && more(); n++) { more().click(); await tick(); }
        await record(tab + ' | ' + filter + ' | All regions | expanded');
      }
    }
  }
  return { text, states };
}

const PAGE_KINDS = { 'index.html': 'overview', 'council.html': 'council', 'statements.html': 'statements', 'method.html': 'method' };

test('every rendered state matches the baseline', { timeout: 900000 }, async () => {
  const server = await startServer();
  const browser = await launch();
  const current = {};
  const errors = [];
  try {
    for (const [file, kind] of Object.entries(PAGE_KINDS)) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      page.on('pageerror', (e) => errors.push(file + ': ' + e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(file + ': ' + m.text()); });
      page.on('response', (r) => { if (r.status() >= 400) errors.push(file + ': ' + r.status() + ' ' + r.url()); });
      await page.goto(server.base + file, { waitUntil: 'networkidle' });
      current[file] = await page.evaluate(capture, kind);
      await page.close();
    }
  } finally { await browser.close(); await server.close(); }

  assert.deepEqual(errors, [], 'pages logged errors');
  const { stored, written } = baseline('render.json', current);
  if (written) return;
  for (const file of Object.keys(PAGE_KINDS)) {
    const now = current[file], was = stored[file];
    const a = was.text.split('\n'), b = now.text.split('\n');
    const line = a.findIndex((x, i) => x !== b[i]);
    assert.equal(line, -1, file + ' default view differs at line ' + (line + 1) + ':\n  was: ' + a[line] + '\n  now: ' + b[line]);
    assert.deepEqual(Object.keys(now.states).sort(), Object.keys(was.states).sort(), file + ': the set of states changed');
    const changed = Object.keys(was.states).filter((k) => was.states[k] !== now.states[k]);
    assert.equal(changed.length, 0, file + ': ' + changed.length + ' of ' + Object.keys(was.states).length + ' states render differently, for example:\n  ' + changed.slice(0, 12).join('\n  '));
  }
  const total = Object.values(current).reduce((a, p) => a + Object.keys(p.states).length, 0);
  console.log('compared ' + total + ' rendered states');
});
