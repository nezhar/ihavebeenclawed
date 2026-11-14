'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dataset = require('../incidents.json');
const nav = require('../archive-navigation.js');
const data = require('../incident-data.js');

function component(search, fetcher) {
  assert.ok(fs.existsSync('incident.html'), 'dedicated incident page exists');
  const html = fs.readFileSync('incident.html', 'utf8');
  const script = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const document = { title: '', documentElement: { dataset: {} }, querySelector: () => null };
  const context = {
    DCLogic: class { setState(patch) { this.state = { ...this.state, ...patch }; } },
    window: { location: { search, href: 'https://archive.test/incident.html' + search }, ArchiveNavigation: nav, IncidentData: data },
    document, URLSearchParams, URL,
    fetch: fetcher || (async () => ({ ok: true, json: async () => dataset })),
    navigator: { clipboard: { writeText: async () => {} } },
    console: { error() {} }
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.instance = new Component();', context);
  return { instance: context.instance, document, context };
}

test('direct incident URL resolves full details and a filter-preserving return link', async () => {
  const item = dataset.incidents[0];
  const { instance, document } = component('?id=' + item.id + '&agent=Claude+Code');
  await instance.loadIncident();
  const view = instance.renderVals();
  assert.equal(view.incident.title, item.title);
  assert.equal(view.incident.details, item.details);
  assert.equal(view.incident.sources.length, item.sources.length);
  assert.equal(view.backHref, './index.html?agent=Claude+Code#index');
  assert.equal(view.loading, false);
  assert.equal(view.notFound, false);
  assert.match(document.title, new RegExp(item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('missing and unknown ids show a not-found state', async () => {
  for (const search of ['', '?id=does-not-exist']) {
    const { instance } = component(search);
    await instance.loadIncident();
    const view = instance.renderVals();
    assert.equal(view.notFound, true);
    assert.equal(view.hasLoadError, false);
    assert.equal(view.hasIncident, false);
  }
});

test('failed requests are distinct from missing incidents and can be retried', async () => {
  let attempts = 0;
  const { instance } = component('?id=' + dataset.incidents[0].id, async () => {
    attempts++;
    if (attempts === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => dataset };
  });
  await instance.loadIncident();
  assert.equal(instance.renderVals().hasLoadError, true);
  assert.equal(instance.renderVals().notFound, false);
  await instance.loadIncident();
  assert.equal(instance.renderVals().hasLoadError, false);
  assert.equal(instance.renderVals().hasIncident, true);
});

test('invalid datasets fail validation instead of rendering partial details', async () => {
  const { instance } = component('?id=' + dataset.incidents[0].id, async () => ({ ok: true, json: async () => ({}) }));
  await instance.loadIncident();
  assert.equal(instance.renderVals().hasLoadError, true);
  assert.equal(instance.renderVals().hasIncident, false);
});

test('copy link excludes filter context and reports clipboard failure accessibly', async () => {
  const item = dataset.incidents[0];
  const { instance, context } = component('?id=' + item.id + '&q=private+search');
  await instance.loadIncident();
  let copied;
  context.navigator.clipboard.writeText = async value => { copied = value; };
  await instance.copyLink();
  assert.equal(copied, 'https://archive.test/incident.html?id=' + item.id);
  assert.equal(instance.renderVals().copyStatus, 'Link copied.');
  context.navigator.clipboard.writeText = async () => { throw new Error('Denied'); };
  await instance.copyLink();
  assert.match(instance.renderVals().copyStatus, /address bar/);
});

test('document title follows the load state', async () => {
  const item = dataset.incidents[0];
  const found = component('?id=' + item.id);
  const pending = found.instance.loadIncident();
  assert.equal(found.document.title, 'Loading incident — ihavebeenclawed');
  await pending;
  assert.equal(found.document.title, item.title + ' — ihavebeenclawed');

  const missing = component('?id=does-not-exist');
  await missing.instance.loadIncident();
  assert.equal(missing.document.title, 'Incident not found — ihavebeenclawed');

  const failed = component('?id=' + item.id, async () => ({ ok: false, status: 503 }));
  await failed.instance.loadIncident();
  assert.equal(failed.document.title, 'Incident unavailable — ihavebeenclawed');
});
