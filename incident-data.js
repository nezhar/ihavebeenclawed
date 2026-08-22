(function expose(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.IncidentData = api;
})(typeof globalThis === 'object' ? globalThis : this, function buildIncidentData() {
  'use strict';

  const EVIDENCE_LEVELS = new Set(['verified', 'reported', 'anecdotal']);
  const DAMAGE_CATEGORIES = new Set([
    'data loss',
    'leaked secrets',
    'runaway cost',
    'production incident',
    'repository damage',
    'service disruption',
    'embarrassment',
    'misinformation',
    'legal harm'
  ]);
  const REQUIRED_TEXT = [
    'id',
    'displayId',
    'title',
    'summary',
    'details',
    'agent',
    'damageCategory',
    'lesson',
    'evidenceLevel'
  ];
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

  function validDate(value) {
    if (!ISO_DATE.test(value || '')) return false;
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
  }

  function validUrl(value) {
    try {
      const url = new URL(value, 'https://repository.local/');
      return value.startsWith('/') ||
        value.startsWith('./') ||
        value.startsWith('#') ||
        ['http:', 'https:'].includes(url.protocol);
    } catch {
      return false;
    }
  }

  function validateDataset(data) {
    const errors = [];
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { ok: false, errors: ['root must be an object'], data: null };
    }
    if (data.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
    if (!validDate(data.updatedAt)) errors.push('updatedAt must be a real YYYY-MM-DD date');
    if (!Array.isArray(data.incidents)) errors.push('incidents must be an array');

    const seen = new Set();
    for (const [index, item] of (data.incidents || []).entries()) {
      const at = `incidents[${index}]`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(`${at} must be an object`);
        continue;
      }
      for (const key of REQUIRED_TEXT) {
        if (typeof item[key] !== 'string' || !item[key].trim()) {
          errors.push(`${at}.${key} must be non-empty text`);
        }
      }
      if (!SLUG.test(item.id || '')) errors.push(`${at}.id must be a lowercase slug`);
      if (seen.has(item.id)) errors.push(`${at}: duplicate id ${item.id}`);
      seen.add(item.id);
      if (item.date !== null && !validDate(item.date)) {
        errors.push(`${at}.date must be null or a real YYYY-MM-DD date`);
      }
      if (!Number.isInteger(item.severity) || item.severity < 1 || item.severity > 5) {
        errors.push(`${at}.severity must be an integer from 1 to 5`);
      }
      if (![true, false, null].includes(item.preventable)) {
        errors.push(`${at}.preventable must be true, false, or null`);
      }
      if (!EVIDENCE_LEVELS.has(item.evidenceLevel)) {
        errors.push(`${at}.evidenceLevel is unsupported`);
      }
      if (!DAMAGE_CATEGORIES.has(item.damageCategory)) {
        errors.push(`${at}.damageCategory is unsupported`);
      }
      for (const flag of ['featured', 'hallOfClaws']) {
        if (item[flag] !== undefined && typeof item[flag] !== 'boolean') {
          errors.push(`${at}.${flag} must be boolean when present`);
        }
      }
      for (const key of ['agentVersion', 'image', 'imageCaption', 'originalTitle']) {
        if (item[key] !== undefined && typeof item[key] !== 'string') {
          errors.push(`${at}.${key} must be text when present`);
        }
      }
      if (item.featured && !item.imageCaption?.trim()) {
        errors.push(`${at}.imageCaption is required for featured incidents`);
      }
      if (!Array.isArray(item.sources) || item.sources.length === 0) {
        errors.push(`${at}.sources must not be empty`);
      }
      if (Array.isArray(item.sources) && item.sources.length > 0 &&
          !item.sources.some((source) => source && typeof source.url === 'string' && /^https?:\/\//i.test(source.url))) {
        errors.push(`${at}.sources must include at least one external HTTP(S) URL`);
      }
      for (const [sourceIndex, source] of (item.sources || []).entries()) {
        if (!source || typeof source !== 'object' || Array.isArray(source)) {
          errors.push(`${at}.sources[${sourceIndex}] source must be an object`);
          continue;
        }
        for (const key of ['title', 'publisher', 'sourceType', 'accessedAt']) {
          if (typeof source[key] !== 'string' || !source[key].trim()) {
            errors.push(`${at}.sources[${sourceIndex}].${key} must be non-empty text`);
          }
        }
        if (!validUrl(source.url)) {
          errors.push(`${at}.sources[${sourceIndex}] has an invalid source URL`);
        }
        if (!validDate(source.accessedAt)) {
          errors.push(`${at}.sources[${sourceIndex}].accessedAt must be a real YYYY-MM-DD date`);
        }
        if (source.archiveUrl !== undefined &&
            (typeof source.archiveUrl !== 'string' ||
              !/^https?:\/\//i.test(source.archiveUrl) ||
              !validUrl(source.archiveUrl))) {
          errors.push(`${at}.sources[${sourceIndex}].archiveUrl must be an http(s) URL when present`);
        }
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      data: errors.length === 0 ? data : null
    };
  }

  function deriveStats(incidents) {
    const known = incidents.filter((item) => item.preventable !== null);
    const preventable = known.filter((item) => item.preventable).length;
    return {
      incidentCount: incidents.length,
      agentCount: new Set(incidents.map((item) => item.agent)).size,
      preventablePercent: known.length ? Math.round((preventable / known.length) * 100) : 0
    };
  }

  return { validateDataset, deriveStats };
});
