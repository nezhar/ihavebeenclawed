'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDataset, deriveStats } = require('../incident-data.js');

const incident = {
  id: 'claude-code-root-rm-10077',
  displayId: 'CC-10077',
  title: 'Recursive deletion reached the home directory',
  summary: 'A user reported that a cleanup command removed user-owned files.',
  details: 'The issue report includes the environment and observed command output.',
  date: '2025-10-21',
  agent: 'Claude Code',
  agentVersion: '2.0.22',
  damageCategory: 'data loss',
  severity: 5,
  preventable: true,
  lesson: 'Resolve and review deletion targets before execution.',
  evidenceLevel: 'reported',
  sources: [{
    title: 'CRITICAL: Claude Code executed rm -rf deleting entire home directory',
    publisher: 'GitHub / anthropics/claude-code',
    url: 'https://github.com/anthropics/claude-code/issues/10077',
    sourceType: 'first-person issue report',
    accessedAt: '2026-08-08'
  }],
  featured: true,
  hallOfClaws: true,
  image: '',
  imageCaption: 'No submitted image is available.'
};

test('accepts a valid dataset and derives statistics', () => {
  const result = validateDataset({ schemaVersion: 1, updatedAt: '2026-08-08', incidents: [incident] });
  assert.equal(result.ok, true);
  assert.deepEqual(deriveStats(result.data.incidents), {
    incidentCount: 1,
    agentCount: 1,
    preventablePercent: 100
  });
});

test('rejects duplicate IDs and unsupported evidence levels', () => {
  const invalid = { ...incident, evidenceLevel: 'confirmed' };
  const result = validateDataset({ schemaVersion: 1, updatedAt: '2026-08-08', incidents: [invalid, invalid] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /duplicate id/);
  assert.match(result.errors.join('\n'), /evidenceLevel/);
});

test('rejects invalid dates, severity, and source URL', () => {
  const invalid = {
    ...incident,
    date: '2025-13-40',
    severity: 6,
    sources: [{ ...incident.sources[0], url: 'javascript:alert(1)' }]
  };
  const result = validateDataset({ schemaVersion: 1, updatedAt: '2026-08-08', incidents: [invalid] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /date/);
  assert.match(result.errors.join('\n'), /severity/);
  assert.match(result.errors.join('\n'), /source URL/);
});

test('returns validation errors for non-object incidents and sources', () => {
  const nullIncident = validateDataset({
    schemaVersion: 1,
    updatedAt: '2026-08-08',
    incidents: [null]
  });
  assert.equal(nullIncident.ok, false);
  assert.match(nullIncident.errors.join('\n'), /must be an object/);

  const nullSource = validateDataset({
    schemaVersion: 1,
    updatedAt: '2026-08-08',
    incidents: [{ ...incident, sources: [null] }]
  });
  assert.equal(nullSource.ok, false);
  assert.match(nullSource.errors.join('\n'), /source must be an object/);
});

test('indexes the six researched issue reports as reported evidence', () => {
  const dataset = require('../incidents.json');
  const expected = new Map([
    ['claude-code-production-seed-85016', 'https://github.com/anthropics/claude-code/issues/85016'],
    ['codex-session-cleanup-37515', 'https://github.com/openai/codex/issues/37515'],
    ['cline-env-overwrite-8422', 'https://github.com/cline/cline/issues/8422'],
    ['cline-windows-move-overwrite-9946', 'https://github.com/cline/cline/issues/9946'],
    ['copilot-whole-file-wipe-14108', 'https://github.com/microsoft/vscode-copilot-release/issues/14108'],
    ['aider-retry-request-storm-4241', 'https://github.com/Aider-AI/aider/issues/4241']
  ]);

  for (const [id, sourceUrl] of expected) {
    const item = dataset.incidents.find((candidate) => candidate.id === id);
    assert.ok(item, `missing researched incident ${id}`);
    assert.equal(item.evidenceLevel, 'reported');
    assert.ok(item.sources.some((source) => source.url === sourceUrl));
  }
});

test('accepts misinformation and legal harm damage categories', () => {
  const misinformation = { ...incident, id: 'chatbot-misinformation', damageCategory: 'misinformation' };
  const legalHarm = { ...incident, id: 'chatbot-legal-harm', damageCategory: 'legal harm' };
  const result = validateDataset({
    schemaVersion: 1,
    updatedAt: '2026-08-08',
    incidents: [misinformation, legalHarm]
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('indexes the ten Linkup-researched incidents with traceable sources', () => {
  const dataset = require('../incidents.json');
  const expected = new Map([
    ['replit-agent-saastr-db-1152', {
      evidence: 'reported',
      url: 'https://www.saastr.com/replits-new-release-address-most-of-the-challenges-we-hit-vibe-coding-but-is-prosumer-vibe-coding-really-ready-for-commercial-apps-yet/'
    }],
    ['gemini-cli-file-move-loss-4586', {
      evidence: 'reported',
      url: 'https://github.com/google-gemini/gemini-cli/issues/4586'
    }],
    ['enrichlead-cursor-security-shutdown', {
      evidence: 'reported',
      url: 'https://x.com/leojr94_/status/1901560276488511759'
    }],
    ['openclaw-inbox-deletion', {
      evidence: 'reported',
      url: 'https://x.com/summeryue0/status/2025774069124399363'
    }],
    ['cursor-support-bot-fake-policy', {
      evidence: 'reported',
      url: 'https://arstechnica.com/ai/2025/04/cursor-ai-support-bot-invents-fake-policy-and-triggers-user-uproar/'
    }],
    ['air-canada-chatbot-ruling', {
      evidence: 'verified',
      url: 'https://decisions.civilresolutionbc.ca/crt/crtd/en/item/525448/index.do'
    }],
    ['dpd-chatbot-poem', {
      evidence: 'reported',
      url: 'https://x.com/ashbeauchamp/status/1748034519104450874'
    }],
    ['chevrolet-chatbot-one-dollar-tahoe', {
      evidence: 'reported',
      url: 'https://x.com/ChrisJBakke/status/1736533308849443121'
    }],
    ['mata-avianca-fabricated-cases', {
      evidence: 'verified',
      url: 'https://law.justia.com/cases/federal/district-courts/new-york/nysdce/1%3A2022cv01461/575368/54/'
    }],
    ['nyc-mycity-illegal-advice', {
      evidence: 'reported',
      url: 'https://themarkup.org/artificial-intelligence/2024/03/29/nycs-ai-chatbot-tells-businesses-to-break-the-law'
    }]
  ]);

  for (const [id, expectation] of expected) {
    const item = dataset.incidents.find((candidate) => candidate.id === id);
    assert.ok(item, `missing Linkup-researched incident ${id}`);
    assert.equal(item.evidenceLevel, expectation.evidence);
    assert.ok(item.sources.some((source) => source.url === expectation.url));
  }
});

test('accepts an http(s) archiveUrl and rejects non-http archive URLs', () => {
  const archived = {
    ...incident,
    sources: [{
      ...incident.sources[0],
      archiveUrl: 'https://web.archive.org/web/20260101000000/https://github.com/anthropics/claude-code/issues/10077'
    }]
  };
  const ok = validateDataset({ schemaVersion: 1, updatedAt: '2026-08-22', incidents: [archived] });
  assert.equal(ok.ok, true, ok.errors.join('\n'));

  for (const bad of ['javascript:alert(1)', './snapshot.html', 42]) {
    const invalid = {
      ...incident,
      sources: [{ ...incident.sources[0], archiveUrl: bad }]
    };
    const result = validateDataset({ schemaVersion: 1, updatedAt: '2026-08-22', incidents: [invalid] });
    assert.equal(result.ok, false, `archiveUrl ${String(bad)} should be rejected`);
    assert.match(result.errors.join('\n'), /archiveUrl/);
  }
});

test('requires at least one external HTTP source per incident', () => {
  const localOnly = {
    ...incident,
    sources: [{
      ...incident.sources[0],
      url: './index.html',
      sourceType: 'local seed content'
    }]
  };
  const result = validateDataset({
    schemaVersion: 1,
    updatedAt: '2026-08-09',
    incidents: [localOnly]
  });

  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /at least one external HTTP\(S\) URL/);
});

test('publishes 93 externally sourced incidents including both Reddit reports', () => {
  const dataset = require('../incidents.json');
  const expected = new Map([
    [
      'fable-ultracode-symlink-data-loss',
      'https://www.reddit.com/r/ClaudeAI/comments/1vcsc7m/fable_5_ultracode_deleted_22m_files_on_my_server/'
    ],
    [
      'claude-opus-backup-drive-wipe',
      'https://www.reddit.com/r/ClaudeCode/comments/1vg18yu/claude_rm_rf_ed_my_pc/'
    ]
  ]);

  assert.equal(dataset.updatedAt, '2026-11-14');
  assert.equal(dataset.incidents.length, 93);
  assert.equal(dataset.incidents.some((item) => item.evidenceLevel === 'anecdotal'), false);

  for (const item of dataset.incidents) {
    assert.ok(
      item.sources.some((source) => /^https?:\/\//i.test(source.url)),
      `${item.id} must have an external source`
    );
  }

  for (const [id, sourceUrl] of expected) {
    const item = dataset.incidents.find((candidate) => candidate.id === id);
    assert.ok(item, `missing Reddit report ${id}`);
    assert.equal(item.evidenceLevel, 'reported');
    assert.ok(item.sources.some((source) => source.url === sourceUrl));
  }
});
