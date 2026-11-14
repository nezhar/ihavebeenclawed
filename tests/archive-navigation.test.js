'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const nav = fs.existsSync('archive-navigation.js') ? require('../archive-navigation.js') : {};
const incidents = require('../incidents.json').incidents;

test('restores filters and normalizes unsupported severity values', () => {
  assert.equal(typeof nav.readFilters, 'function');
  assert.deepEqual(nav.readFilters('?q=lost+files&agent=Claude+Code&damage=data+loss&sev=4'), {
    q: 'lost files', agent: 'Claude Code', damage: 'data loss', sev: 4, page: 1
  });
  assert.equal(nav.readFilters('?sev=garbage').sev, 0);
  assert.equal(nav.readFilters('?sev=8').sev, 0);
});

test('round trips search and filters without including unrelated parameters', () => {
  assert.equal(typeof nav.archiveHref, 'function');
  const filters = { q: 'files & secrets', agent: 'Claude Code', damage: 'all', sev: 3, page: 1 };
  const url = new URL(nav.archiveHref(filters), 'https://archive.test/');
  assert.deepEqual(nav.readFilters(url.search), filters);
  assert.equal(url.hash, '#index');
  assert.equal(nav.archiveHref({ q: '', agent: 'all', damage: 'all', sev: 0 }), './index.html#index');
});

test('incident links carry a stable id and the archive filter context', () => {
  assert.equal(typeof nav.incidentHref, 'function');
  const filters = { q: 'delete', agent: 'Claude Code', damage: 'all', sev: 4 };
  const url = new URL(nav.incidentHref(incidents[0].id, filters), 'https://archive.test/');
  assert.equal(url.pathname, '/incident.html');
  assert.equal(url.searchParams.get('id'), incidents[0].id);
  assert.equal(nav.returnHref(url.search), nav.archiveHref(filters));
  assert.equal(nav.returnHref('?id=anything&return=https://evil.test&sev=bad'), './index.html#index');
});

test('search matches identifiers, titles, products, summaries, and full accounts case insensitively', () => {
  assert.equal(typeof nav.filterIncidents, 'function');
  for (const field of ['displayId', 'title', 'agent', 'summary', 'details']) {
    const row = incidents[0];
    const result = nav.filterIncidents(incidents, { q: row[field].toUpperCase(), agent: 'all', damage: 'all', sev: 0 });
    assert.ok(result.some(item => item.id === row.id), field);
  }
  assert.equal(nav.filterIncidents(incidents, { q: '   ', agent: 'all', damage: 'all', sev: 0 }).length, incidents.length);
});

test('combines search, product, damage and severity, including empty results', () => {
  assert.equal(typeof nav.filterIncidents, 'function');
  const row = incidents.find(item => item.severity >= 3);
  const filters = { q: row.displayId, agent: row.agent, damage: row.damageCategory, sev: 3 };
  assert.deepEqual(nav.filterIncidents(incidents, filters).map(item => item.id), [row.id]);
  assert.deepEqual(nav.filterIncidents(incidents, { ...filters, q: 'no-such-incident-xyz' }), []);
  assert.deepEqual(nav.filterIncidents(incidents, { ...filters, agent: 'nonexistent' }), []);
});

test('page parameter defaults to 1, is omitted at 1, and round trips above 1', () => {
  for (const search of ['', '?page=', '?page=abc', '?page=0', '?page=-2', '?page=1.5']) {
    assert.equal(nav.readFilters(search).page, 1, search);
  }
  assert.equal(nav.readFilters('?page=3').page, 3);
  const filters = { q: 'rm', agent: 'Codex', damage: 'data loss', sev: 4, page: 3 };
  const url = new URL(nav.archiveHref(filters), 'https://archive.test/');
  assert.equal(url.searchParams.get('page'), '3');
  assert.deepEqual(nav.readFilters(url.search), filters);
  assert.equal(nav.archiveHref({ ...filters, page: 1 }).includes('page='), false);
});

test('incident and return links carry the archive page', () => {
  const filters = { q: '', agent: 'all', damage: 'all', sev: 0, page: 4 };
  const url = new URL(nav.incidentHref(incidents[0].id, filters), 'https://archive.test/');
  assert.equal(url.searchParams.get('page'), '4');
  assert.equal(nav.returnHref(url.search), './index.html?page=4#index');
});

test('sorts newest first with undated incidents last and ties in input order', () => {
  const rows = [
    { id: 'a', date: '2026-01-01' }, { id: 'b', date: null }, { id: 'c', date: '2026-05-01' },
    { id: 'd', date: '2026-01-01' }, { id: 'e', date: null }, { id: 'f', date: '2025-12-31' }
  ];
  const before = rows.map(row => row.id).join('');
  assert.deepEqual(nav.sortNewestFirst(rows).map(row => row.id), ['c', 'a', 'd', 'f', 'b', 'e']);
  assert.equal(rows.map(row => row.id).join(''), before);
});

test('paginates with clamped pages and 1-based ranges', () => {
  const items = Array.from({ length: 30 }, (_, index) => index + 1);
  assert.equal(nav.PAGE_SIZE, 12);
  assert.deepEqual(nav.paginate(items, 1), { items: items.slice(0, 12), page: 1, pages: 3, total: 30, from: 1, to: 12 });
  assert.deepEqual(nav.paginate(items, 2), { items: items.slice(12, 24), page: 2, pages: 3, total: 30, from: 13, to: 24 });
  assert.deepEqual(nav.paginate(items, 3), { items: items.slice(24), page: 3, pages: 3, total: 30, from: 25, to: 30 });
  assert.equal(nav.paginate(items, 99).page, 3);
  assert.equal(nav.paginate(items, 0).page, 1);
  assert.equal(nav.paginate(items, undefined).page, 1);
  assert.deepEqual(nav.paginate([], 5), { items: [], page: 1, pages: 1, total: 0, from: 0, to: 0 });
  assert.equal(nav.paginate(items, 2, 10).to, 20);
});
