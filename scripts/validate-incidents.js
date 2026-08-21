#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validateDataset } = require('../incident-data.js');

const file = path.resolve(__dirname, '..', 'incidents.json');
let parsed;
try {
  parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (error) {
  console.error(`incidents.json: ${error.message}`);
  process.exit(1);
}

const result = validateDataset(parsed);
if (!result.ok) {
  console.error(result.errors.join('\n'));
  process.exit(1);
}

console.log(`incidents.json: ${result.data.incidents.length} valid incidents`);
