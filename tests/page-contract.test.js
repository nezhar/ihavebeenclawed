'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');
const detailHtml = fs.readFileSync('incident.html', 'utf8');

test('loads the shared contract and JSON store', () => {
  assert.match(html, /<script src="\.\/incident-data\.js"><\/script>/);
  assert.match(html, /fetch\("\.\/incidents\.json"/);
});

test('does not embed duplicate incident collections', () => {
  assert.doesNotMatch(html, /const (DATA|FEATURED|HALL)\s*=/);
});

test('renders loading and error states', () => {
  assert.match(html, /Loading incident archive/);
  assert.match(html, /Unable to load incident archive/);
});

test('describes the expanded AI-agent and chatbot archive', () => {
  assert.match(html, /incidents involving AI agents and chatbots/);
  assert.doesNotMatch(html, /coding-agent incidents/);
});

test('links archive, featured and hall titles to dedicated incident pages', () => {
  for (const binding of ['s', 'featured', 'h']) {
    assert.ok(html.includes('href="{{ ' + binding + '.detailHref }}"'));
  }
  assert.doesNotMatch(html, /role="dialog"|aria-haspopup="dialog"/);
  assert.match(detailHtml, /<h1>{{ incident\.title }}<\/h1>/);
  assert.match(detailHtml, /{{ incident\.details }}/);
  assert.match(detailHtml, /{{ incident\.lesson }}/);
  assert.match(detailHtml, /sc-for list="{{ incident\.sources }}"/);
  assert.match(detailHtml, /href="{{ backHref }}"/);
});

test('hall cards summarize the incident rather than the evidence caveat', () => {
  assert.match(html, /body: item\.summary/);
  assert.doesNotMatch(html, /body: item\.details/);
});

test('opens remote incident sources safely in a new tab', () => {
  assert.match(detailHtml, /target="{{ source\.target }}" rel="{{ source\.rel }}"/);
  assert.match(detailHtml, /href="{{ source\.archiveUrl }}" target="_blank" rel="noopener noreferrer"/);
  assert.match(html, /target="{{ featured\.target }}" rel="{{ featured\.rel }}"/);
  assert.match(html, /noopener noreferrer/);
});

test('keeps the legacy page as a redirect without duplicate app code', () => {
  const legacy = fs.readFileSync('ihavebeenclawed.dc.html', 'utf8');
  assert.match(legacy, /http-equiv="refresh" content="0; url=\.\/index\.html"/);
  assert.doesNotMatch(legacy, /<x-dc>|fetch\("\.\/incidents\.json"/);
});

test('page titles live in the document head, not in the runtime helmet', () => {
  // The DC helmet copies <title> text verbatim on every render, so a templated title shows up as raw braces.
  for (const page of [html, detailHtml]) {
    const head = page.match(/<head>([\s\S]*?)<\/head>/)[1];
    const helmet = page.match(/<helmet>([\s\S]*?)<\/helmet>/)[1];
    assert.match(head, /<title>[^<{]+<\/title>/);
    assert.doesNotMatch(helmet, /<title/);
  }
});

test('archive pager is a labeled navigation landmark below a focusable heading', () => {
  assert.match(html, /<h2 id="archive-title" tabIndex="-1">/);
  assert.match(html, /<nav class="pager" aria-label="Archive pages">/);
  assert.match(html, /href="{{ nextPage\.href }}" onClick="{{ nextPage\.onClick }}"/);
  assert.match(html, /aria-disabled="true"/);
});
