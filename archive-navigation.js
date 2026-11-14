(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ArchiveNavigation = api;
})(typeof globalThis === 'object' ? globalThis : this, function buildNavigation() {
  'use strict';

  const PAGE_SIZE = 12;

  function readFilters(search) {
    const params = new URLSearchParams(search);
    const severity = Number(params.get('sev'));
    const page = Number(params.get('page'));
    return {
      q: params.get('q') || '',
      agent: params.get('agent') || 'all',
      damage: params.get('damage') || 'all',
      sev: [3, 4, 5].includes(severity) ? severity : 0,
      page: Number.isInteger(page) && page > 1 ? page : 1
    };
  }

  function filterParams(filters = {}) {
    const params = new URLSearchParams();
    if (filters.q) params.set('q', filters.q);
    if (filters.agent && filters.agent !== 'all') params.set('agent', filters.agent);
    if (filters.damage && filters.damage !== 'all') params.set('damage', filters.damage);
    if ([3, 4, 5].includes(filters.sev)) params.set('sev', filters.sev);
    // Page 1 is the default, so existing archive URLs stay unchanged.
    if (Number.isInteger(filters.page) && filters.page > 1) params.set('page', filters.page);
    return params;
  }

  function archiveHref(filters) {
    const query = filterParams(filters).toString();
    return './index.html' + (query ? '?' + query : '') + '#index';
  }

  function incidentHref(id, filters) {
    const params = new URLSearchParams({ id });
    for (const [key, value] of filterParams(filters)) params.set(key, value);
    return './incident.html?' + params.toString();
  }

  function returnHref(search) {
    return archiveHref(readFilters(search));
  }

  function filterIncidents(incidents, filters) {
    const query = (filters.q || '').trim().toLowerCase();
    return incidents.filter(item =>
      (!filters.agent || filters.agent === 'all' || item.agent === filters.agent) &&
      (!filters.damage || filters.damage === 'all' || item.damageCategory === filters.damage) &&
      item.severity >= (filters.sev || 0) &&
      (!query || [item.id, item.displayId, item.title, item.originalTitle, item.agent, item.summary, item.details]
        .filter(Boolean).join(' ').toLowerCase().includes(query))
    );
  }

  function sortNewestFirst(incidents) {
    // ISO dates compare correctly as strings; undated incidents sort last. The sort is stable, so ties keep dataset order.
    return [...incidents].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  function paginate(items, page, size = PAGE_SIZE) {
    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, Number.isInteger(page) ? page : 1), pages);
    const start = (current - 1) * size;
    const slice = items.slice(start, start + size);
    return { items: slice, page: current, pages, total, from: total ? start + 1 : 0, to: start + slice.length };
  }

  function readTheme() {
    try { return localStorage.getItem('clawed-theme') === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  }

  function saveTheme(theme) {
    try { localStorage.setItem('clawed-theme', theme); } catch { /* Storage can be disabled. */ }
  }

  return { PAGE_SIZE, readFilters, archiveHref, incidentHref, returnHref, filterIncidents, sortNewestFirst, paginate, readTheme, saveTheme };
});
