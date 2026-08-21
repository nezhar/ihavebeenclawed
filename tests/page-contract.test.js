'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const html = fs.readFileSync('index.html', 'utf8');

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

test('opens story details in an accessible modal', () => {
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="{{ modal\.labelId }}"/);
  assert.match(html, /onClick="{{ s\.onClick }}"/);
  assert.match(html, /onKeyDown="{{ s\.onKeyDown }}"/);
  assert.match(html, /sc-for list="{{ modal\.sources }}"/);
  assert.match(html, /data-incident-modal/);
  assert.match(html, /data-modal-close/);
});

test('hall cards summarize the incident rather than the evidence caveat', () => {
  assert.match(html, /body: item\.summary/);
  assert.doesNotMatch(html, /body: item\.details/);
});

test('opens remote incident sources safely in a new tab', () => {
  assert.match(html, /target="{{ s\.target }}" rel="{{ s\.rel }}"/);
  assert.match(html, /target="{{ modalSource\.target }}" rel="{{ modalSource\.rel }}"/);
  assert.match(html, /target="{{ featured\.target }}" rel="{{ featured\.rel }}"/);
  assert.match(html, /target="{{ h\.target }}" rel="{{ h\.rel }}"/);
  assert.match(html, /noopener noreferrer/);
  assert.match(html, /stopPropagation/);
});

test('keeps the legacy page as a redirect without duplicate app code', () => {
  const legacy = fs.readFileSync('ihavebeenclawed.dc.html', 'utf8');
  assert.match(legacy, /http-equiv="refresh" content="0; url=\.\/index\.html"/);
  assert.doesNotMatch(legacy, /<x-dc>|fetch\("\.\/incidents\.json"/);
});
