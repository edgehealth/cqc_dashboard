// Checks on the dashboard data itself: that it has not changed unintentionally,
// that every page sees the same data, and that figures written into the prose
// still agree with it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { PAGES, read, sha, inlineData, dataScripts, dataFor, baseline } = require('./helpers');

const canonical = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((key) => [key, x[key]])) : x));
const withoutIntro = (statements) => statements.map(({ intro, ...rest }) => rest);
const text = (file) => read(file).replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const D = Object.fromEntries(PAGES.map((p) => [p, dataFor(p)]));
const councils = D['index.html'].COUNCILS;
const statements = D['statements.html'].STATEMENTS;
const pool = D['statements.html'].POOL;
const quotes = D['council.html'].QUOTES;

test('data matches the stored baseline', () => {
  const current = {
    COUNCILS: sha(canonical(councils)), STATEMENTS: sha(canonical(statements)), STATEMENTS_without_intro: sha(canonical(withoutIntro(statements))),
    POOL: sha(canonical(pool)), QUOTES: sha(canonical(quotes)),
    counts: { councils: councils.length, statements: statements.length, examples: Object.values(pool).flat(2).length, quotes: Object.values(quotes).flat().reduce((a, q) => a + (q.q || []).length, 0) },
  };
  const { stored } = baseline('data.json', current);
  assert.deepEqual(current, stored);
});

test('every page sees identical data', () => {
  const base = baseline('data.json', null).stored;
  for (const p of PAGES) {
    const d = D[p];
    if (d.COUNCILS) assert.equal(sha(canonical(d.COUNCILS)), base.COUNCILS, p + ' COUNCILS');
    if (d.POOL) assert.equal(sha(canonical(d.POOL)), base.POOL, p + ' POOL');
    if (d.QUOTES) assert.equal(sha(canonical(d.QUOTES)), base.QUOTES, p + ' QUOTES');
    if (d.STATEMENTS) assert.equal(sha(canonical(withoutIntro(d.STATEMENTS))), base.STATEMENTS_without_intro, p + ' STATEMENTS');
  }
});

test('data lives in shared files, not inside the pages', () => {
  const owners = {};
  for (const p of PAGES) {
    assert.deepEqual(Object.keys(inlineData(p)), [], p + ' still defines data inline');
    for (const src of dataScripts(p)) (owners[src] = owners[src] || []).push(p);
  }
  assert.ok(Object.keys(owners).length > 0, 'no shared data files are loaded');
  const definedIn = {};
  for (const src of Object.keys(owners)) for (const m of read(src).matchAll(/^const ([A-Z_]+) = /gm)) (definedIn[m[1]] = definedIn[m[1]] || []).push(src);
  for (const name of ['COUNCILS', 'STATEMENTS', 'QUOTES', 'POOL']) assert.equal((definedIn[name] || []).length, 1, name + ' should be defined in exactly one file');
});

test('council records are well formed', () => {
  assert.equal(new Set(councils.map((c) => c.n)).size, councils.length, 'duplicate council names');
  const bands = (pct) => (pct >= 88 ? 'Outstanding' : pct >= 63 ? 'Good' : pct >= 39 ? 'Requires improvement' : 'Inadequate');
  for (const c of councils) {
    assert.equal(c.s.length, 9, c.n); assert.equal(c.pg.length, 9, c.n);
    assert.ok(c.s.every((x) => [1, 2, 3, 4].includes(x)), c.n + ' scores');
    assert.equal(c.pct, Math.ceil((c.s.reduce((a, b) => a + b, 0) / 36) * 100), c.n + ' overall percentage');
    assert.equal(c.rating, bands(c.pct), c.n + ' rating band');
    assert.ok(!Number.isNaN(Date.parse(c.pub)), c.n + ' publication date');
    assert.match(c.u, /^[a-z0-9-]+\/[a-z0-9-]+$/, c.n + ' CQC report path');
    assert.ok(c.pg.every((p, i) => i === 0 || p > c.pg[i - 1]), c.n + ' page numbers increase');
  }
});

test('quotes and examples cover every council and statement', () => {
  for (const c of councils) {
    for (let i = 0; i < 9; i++) {
      const lo = c.pg[i] - 1, hi = (i < 8 ? c.pg[i + 1] : c.pg[i] + 40) + 1;
      const q = quotes[c.n][i], ex = pool[c.n][i];
      if (c.s[i] <= 2) assert.ok(q.q.length > 0, c.n + ' statement ' + i + ' has no quotes');
      if (c.s[i] >= 3) assert.ok(ex.length > 0, c.n + ' statement ' + i + ' has no examples');
      for (const [page, sentence] of [...(q.q || []), ...ex]) {
        assert.ok(page >= lo && page <= hi, c.n + ' statement ' + i + ' page ' + page + ' outside its section');
        assert.ok(sentence.length >= 40 && !sentence.includes('<') && !/Ã|â€|�/.test(sentence), c.n + ' statement ' + i + ' sentence looks wrong');
      }
    }
  }
});

test('figures written into the prose agree with the data', () => {
  const n = councils.length;
  const count = (f) => councils.filter(f).length;
  const names = (f) => councils.filter(f).map((c) => c.n);
  // Every "N published ... reports" / "all N" mention across the pages, including descriptions.
  for (const p of PAGES) for (const m of read(p).matchAll(/\b(\d{2,3}) (?:published|local authority assessment reports|reports)\b/g)) assert.equal(Number(m[1]), n, p + ': "' + m[0] + '"');
  const method = text('method.html');
  for (const [rating, word] of [['Outstanding', 'rated outstanding'], ['Good', 'rated good'], ['Requires improvement', 'rated requires improvement'], ['Inadequate', 'rated inadequate']]) {
    assert.ok(method.includes(count((c) => c.rating === rating) + ' ' + word), 'method page count for ' + rating);
  }
  for (const name of [...names((c) => c.rating === 'Outstanding'), ...names((c) => c.rating === 'Inadequate'), ...names((c) => c.stale)]) assert.ok(method.includes(name), 'method page should name ' + name);
  // Findings on the overview that are written by hand.
  const overview = text('index.html');
  assert.ok(overview.includes('In all ' + count((c) => c.s[0] === 1) + ' councils that scored 1'), 'overview: councils scoring 1 on assessing needs');
  const outstanding = names((c) => c.rating === 'Outstanding');
  assert.ok(outstanding.every((name) => overview.includes(name)), 'overview names every outstanding council');
  assert.ok(councils.filter((c) => c.rating === 'Outstanding').every((c) => c.s[4] === 4 && c.s[7] === 4), 'outstanding councils all scored 4 on partnerships and governance');
  assert.deepEqual(names((c) => c.s[0] === 4), ['Wigan'], 'Wigan is the only council scoring 4 on assessing needs');
  assert.ok(text('statements.html').length > 0);
  assert.ok(statements[0].intro.includes('In all ' + count((c) => c.s[0] === 1) + ' councils that scored 1'), 'assessing needs key finding');
});
