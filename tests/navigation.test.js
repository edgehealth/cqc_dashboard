// Behaviour checks in a real browser: shareable links, back button, links
// between pages, and that figures follow the data when the data changes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { read, slug, dataFor, dataScripts, startServer, launch } = require('./helpers');

let server, browser, page, errors;
const councils = dataFor('index.html').COUNCILS;
const settle = () => page.waitForTimeout(150);
const h1 = () => page.textContent('h1');
const open = (rel) => page.goto(server.base + rel, { waitUntil: 'networkidle' });

test.before(async () => { server = await startServer(); browser = await launch(); });
test.after(async () => { await browser.close(); await server.close(); });
test.beforeEach(async () => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(r.status() + ' ' + r.url()); });
});
test.afterEach(async () => { await page.close(); assert.deepEqual(errors, []); });

test('a link to any council opens that council', async () => {
  await open('council.html#wigan');
  assert.equal(await h1(), 'Wigan');
  assert.match(await page.title(), /^Wigan council profile \|/);
  assert.equal(await page.inputValue('#council-select'), 'Wigan');
  for (const c of councils) {
    await page.evaluate((h) => { location.hash = h; }, slug(c.n));
    await page.waitForFunction((n) => document.querySelector('h1').textContent === n, c.n, { timeout: 5000 });
  }
});

test('choosing a council updates the address, survives a reload and works with back', async () => {
  await open('council.html');
  assert.equal(await h1(), councils[0].n);
  await page.selectOption('#council-select', 'Stoke-on-Trent'); await settle();
  assert.ok(page.url().endsWith('#stoke-on-trent'));
  await page.selectOption('#council-select', 'Bournemouth, Christchurch and Poole'); await settle();
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await h1(), 'Bournemouth, Christchurch and Poole');
  await page.goBack(); await settle();
  assert.equal(await h1(), 'Stoke-on-Trent');
  assert.equal(await page.inputValue('#council-select'), 'Stoke-on-Trent');
  await page.goBack(); await settle();
  assert.equal(await h1(), councils[0].n);
});

test('an unknown council link falls back to the first council', async () => {
  await open('council.html#not-a-council');
  assert.equal(await h1(), councils[0].n);
});

test('peer buttons and example cards on a profile lead to the right council', async () => {
  await open('council.html#salford');
  const peer = page.locator('button:has-text("(scored")').first();
  const peerName = (await peer.textContent()).replace(/ \(scored.*/, '');
  await peer.click(); await settle();
  assert.equal(await h1(), peerName);
  assert.ok(page.url().endsWith('#' + slug(peerName)));
  await open('council.html#salford'); await page.reload({ waitUntil: 'networkidle' });
  const card = page.locator('article a[href^="#"]').first();
  const cardName = await card.textContent();
  await card.click(); await settle();
  assert.equal(await h1(), cardName);
});

test('profile and quote references link to the CQC report', async () => {
  await open('council.html#salford');
  const salford = councils.find((c) => c.n === 'Salford');
  const expected = 'https://www.cqc.org.uk/care-services/local-authority-assessment-reports/' + salford.u;
  assert.equal(await page.getAttribute('a:has-text("Read the report on the CQC website")', 'href'), expected);
  assert.equal(await page.getAttribute('blockquote a', 'href'), expected);
});

test('statement links, tabs and the examples link behave', async () => {
  const slugs = ['assessing-needs', 'healthier-lives', 'equity', 'care-provision', 'partnerships', 'safe-pathways', 'safeguarding', 'governance', 'learning'];
  const labels = dataFor('statements.html').STATEMENTS.map((s) => s.label);
  for (let i = 0; i < 9; i++) { await open('statements.html#' + slugs[i]); await page.reload({ waitUntil: 'networkidle' }); assert.equal(await h1(), labels[i]); }
  await open('statements.html'); await page.reload({ waitUntil: 'networkidle' });
  await page.click('nav[aria-label="Quality statements"] button:has-text("Safeguarding")'); await settle();
  assert.ok(page.url().endsWith('#safeguarding'));
  assert.match(await page.title(), /^Safeguarding \|/);
  await page.click('a:has-text("See ")'); await settle();
  assert.ok(page.url().endsWith('#safeguarding'), 'the examples link must not replace the statement in the address');
  assert.notEqual(await page.locator('[aria-label="Filter by area"] button[aria-pressed="true"]').textContent(), 'All examples');
  await page.goBack(); await settle();
  assert.equal(await h1(), labels[0]);
  await open('statements.html#governance'); await page.reload({ waitUntil: 'networkidle' });
  const example = page.locator('#good-practice article a[href^="council.html#"]').first();
  const name = await example.textContent();
  await example.click(); await page.waitForLoadState('networkidle');
  assert.equal(await h1(), name);
});

test('region links and heatmap links behave on the overview', async () => {
  await open('#london'); await page.reload({ waitUntil: 'networkidle' });
  const pressed = () => page.locator('[aria-label="Region"] button[aria-pressed="true"]').textContent();
  const london = councils.filter((c) => c.r === 'London').length;
  assert.equal(await pressed(), 'London (' + london + ')');
  assert.equal(await page.locator('[role=table] [role=row]').count(), london + 2);
  await page.click('button:has-text("South West")'); await settle();
  assert.ok(page.url().endsWith('#south-west'));
  await page.goBack(); await settle();
  assert.equal(await pressed(), 'London (' + london + ')');
  const row = page.locator('[role=table] [role=cell] a').first();
  const name = await row.textContent();
  await row.click(); await page.waitForLoadState('networkidle');
  assert.equal(await h1(), name);
});

test('headline figures follow the data when the data changes', async () => {
  // Serve a modified dataset: two fewer councils, and every council scoring 1 on partnerships.
  const file = dataScripts('index.html').find((src) => /^const COUNCILS = /m.test(read(src)));
  assert.ok(file, 'the overview should load council data from a shared file');
  const changed = councils.slice(0, -2).map((c) => ({ ...c, s: c.s.map((x, i) => (i === 4 ? 1 : x)) }));
  await page.route('**/' + file, (route) => route.fulfill({ contentType: 'application/javascript', body: 'const COUNCILS = ' + JSON.stringify(changed) + ';' }));
  await open('index.html');
  const tiles = await page.locator('section[aria-label="Headline figures"]').innerText();
  const n = changed.length;
  assert.match(tiles, new RegExp('Councils assessed\\s+' + n + '\\b'));
  assert.match(tiles, /Lowest scoring statement\s+Partnerships and communities/);
  assert.ok(tiles.includes('Average 1.0 out of 4; ' + n + ' of ' + n + ' councils scored 1 or 2'), tiles);
  assert.ok(!tiles.includes('Highest scoring statement\nPartnerships'), 'partnerships can no longer be the highest');
  await open('council.html');
  assert.ok((await page.locator('[aria-live="polite"]').innerText()).includes(' of ' + n + ' councils scored'));
});
