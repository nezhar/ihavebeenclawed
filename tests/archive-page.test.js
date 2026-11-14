'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dataset = require('../incidents.json');

function component({ search = '', hash = '', historyState = null } = {}) {
  const script = fs.readFileSync('index.html', 'utf8').match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const scrolls = [];
  const context = {
    DCLogic: class { setState(patch) { this.state = { ...this.state, ...patch }; } },
    window: {
      ArchiveNavigation: require('../archive-navigation.js'), IncidentData: require('../incident-data.js'),
      location: { search, hash, pathname: '/index.html', href: 'https://archive.test/index.html' + search + hash },
      history: {
        state: historyState, pushed: 0,
        replaceState(state, title, url) { this.state = state; this.url = url; },
        pushState(state, title, url) { this.state = state; this.url = url; this.pushed++; }
      },
      scrollTo(x, y) { scrolls.push({ y }); }
    },
    document: {
      title: '',
      getElementById(id) {
        if (id === 'index') return { scrollIntoView() { scrolls.push({ anchor: id }); } };
        if (id === 'archive-title') return { focus() { scrolls.push({ focus: id }); } };
        return null;
      }
    },
    fetch: async () => ({ ok: true, json: async () => dataset }),
    requestAnimationFrame: fn => fn(), URL, console
  };
  vm.createContext(context);
  vm.runInContext(script + '\nthis.instance = new Component();', context);
  return { instance: context.instance, scrolls, context };
}

test('return links scroll to the archive after async content has rendered', async () => {
  const { instance, scrolls } = component({ hash: '#index' });
  await instance.loadIncidents();
  assert.deepEqual(scrolls, [{ anchor: 'index' }]);
});

test('saved browser Back position takes priority over the fragment', async () => {
  const { instance, scrolls } = component({ hash: '#index', historyState: { archiveScroll: 1240 } });
  await instance.loadIncidents();
  assert.deepEqual(scrolls, [{ y: 1240 }]);
});

test('filter changes replace the query without retaining a stale scroll position', () => {
  const { instance, context } = component({ hash: '#index', historyState: { archiveScroll: 1240 } });
  instance.changeFilter('q', 'lost files');
  assert.equal(instance.state.q, 'lost files');
  assert.equal(context.window.history.url, '/index.html?q=lost+files#index');
  assert.equal(context.window.history.state, null);
  instance.clearFilters();
  assert.equal(context.window.history.url, '/index.html#index');
  assert.equal(instance.state.q, '');
});

test('shows the twelve newest incidents per page with a range label and pager links', async () => {
  const { instance } = component();
  await instance.loadIncidents();
  const total = dataset.incidents.length;
  const pages = Math.ceil(total / 12);
  const newest = dataset.incidents.map(item => item.date).filter(Boolean).sort().pop();
  let view = instance.renderVals();
  assert.equal(view.stories.length, 12);
  assert.equal(view.stories[0].date, newest);
  assert.equal(view.resultLabel, '1–12 of ' + total + ' incidents');
  assert.equal(view.showPager, true);
  assert.equal(view.pageLabel, 'Page 1 of ' + pages);
  assert.equal(view.prevPage.disabled, true);
  assert.equal(view.nextPage.href, './index.html?page=2#index');

  instance.setState({ page: 99 });
  view = instance.renderVals();
  assert.equal(view.pageLabel, 'Page ' + pages + ' of ' + pages);
  assert.equal(view.stories.length, total - 12 * (pages - 1));
  assert.equal(view.nextPage.disabled, true);
  assert.equal(view.prevPage.href, './index.html?page=' + (pages - 1) + '#index');
  assert.match(view.stories[0].detailHref, new RegExp('page=' + pages + '$'));
  assert.equal(view.stories.at(-1).date, null);
});

test('filtered results get their own range label and hide the pager on a single page', async () => {
  const { instance } = component();
  await instance.loadIncidents();
  instance.setState({ agent: 'Gemini CLI' });
  const count = dataset.incidents.filter(item => item.agent === 'Gemini CLI').length;
  const view = instance.renderVals();
  assert.equal(view.resultLabel, '1–' + count + ' of ' + count + ' matching incidents');
  assert.equal(view.showPager, false);
  instance.setState({ q: 'no-such-incident-xyz' });
  assert.equal(instance.renderVals().resultLabel, '0 of ' + dataset.incidents.length + ' incidents');
  assert.equal(instance.renderVals().showEmpty, true);
});

test('search and filter changes return to the first page', () => {
  const { instance, context } = component({ hash: '#index' });
  instance.setState({ page: 3 });
  instance.changeFilter('agent', 'Codex');
  assert.equal(instance.state.page, 1);
  assert.equal(context.window.history.url, '/index.html?agent=Codex#index');
  instance.setState({ page: 2 });
  instance.clearFilters();
  assert.equal(instance.state.page, 1);
  assert.equal(context.window.history.url, '/index.html#index');
});

test('paging pushes a history entry, scrolls to the archive and focuses its heading', async () => {
  const { instance, context, scrolls } = component();
  await instance.loadIncidents();
  instance.goToPage(2);
  assert.equal(instance.state.page, 2);
  assert.equal(context.window.history.pushed, 1);
  assert.equal(context.window.history.url, '/index.html?page=2#index');
  assert.deepEqual(scrolls, [{ anchor: 'index' }, { focus: 'archive-title' }]);
});

test('a page restored from the URL, as Back and Forward do, renders that page', async () => {
  const { instance, context } = component();
  await instance.loadIncidents();
  instance.setState(context.window.ArchiveNavigation.readFilters('?page=3'));
  const view = instance.renderVals();
  assert.match(view.pageLabel, /^Page 3 of /);
  assert.match(view.resultLabel, /^25–36 of /);
});

test('pager links leave modified clicks to the browser', async () => {
  const { instance } = component();
  await instance.loadIncidents();
  let prevented = 0;
  const click = extra => ({ button: 0, preventDefault() { prevented++; }, ...extra });
  instance.renderVals().nextPage.onClick(click({ metaKey: true }));
  instance.renderVals().nextPage.onClick(click({ ctrlKey: true }));
  instance.renderVals().nextPage.onClick(click({ button: 1 }));
  assert.equal(prevented, 0);
  assert.equal(instance.state.page, 1);
  instance.renderVals().nextPage.onClick(click());
  assert.equal(prevented, 1);
  assert.equal(instance.state.page, 2);
});

test('document title names archive pages beyond the first', async () => {
  const { instance, context } = component();
  await instance.loadIncidents();
  instance.syncTitle();
  assert.equal(context.document.title, 'ihavebeenclawed — an index of agent incidents');
  instance.setState({ page: 2 });
  instance.syncTitle();
  assert.match(context.document.title, /^Archive, page 2 of \d+ — ihavebeenclawed$/);
});
