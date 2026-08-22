#!/usr/bin/env node
'use strict';

// Fills in `archiveUrl` on every external incident source by asking the
// Wayback Machine for an existing snapshot and, failing that, requesting a
// new capture. Idempotent: sources that already carry an archiveUrl are
// skipped, so the script can be re-run until every source is covered.
//
// Usage: node scripts/archive-sources.js [--dry-run] [--limit N]

const fs = require('node:fs');
const path = require('node:path');

const DATASET_PATH = path.join(__dirname, '..', 'incidents.json');
const AVAILABILITY_API = 'https://archive.org/wayback/available?url=';
const SAVE_API = 'https://web.archive.org/save/';
const REQUEST_GAP_MS = 15000;
const RATE_LIMIT_BACKOFF_MS = 90000;
const MAX_ATTEMPTS = 3;

const dryRun = process.argv.includes('--dry-run');
const limitFlag = process.argv.indexOf('--limit');
const limit = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithBackoff(url, options) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        console.log(`  rate limited, waiting ${RATE_LIMIT_BACKOFF_MS / 1000}s (attempt ${attempt}/${MAX_ATTEMPTS})`);
        await sleep(RATE_LIMIT_BACKOFF_MS);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;
      await sleep(REQUEST_GAP_MS * attempt);
    }
  }
  return null;
}

async function findSnapshot(url) {
  const response = await fetchWithBackoff(AVAILABILITY_API + encodeURIComponent(url));
  if (!response || !response.ok) return null;
  const payload = await response.json();
  const closest = payload && payload.archived_snapshots && payload.archived_snapshots.closest;
  if (closest && closest.available && /^https?:\/\//i.test(closest.url)) {
    return closest.url.replace(/^http:\/\//i, 'https://');
  }
  return null;
}

async function requestCapture(url) {
  const response = await fetchWithBackoff(SAVE_API + url, { redirect: 'follow' });
  if (!response) return null;
  // A successful capture redirects to the snapshot URL.
  if (response.ok && /web\.archive\.org\/web\//.test(response.url)) {
    return response.url.replace(/^http:\/\//i, 'https://');
  }
  const contentLocation = response.headers.get('content-location');
  if (contentLocation && contentLocation.startsWith('/web/')) {
    return 'https://web.archive.org' + contentLocation;
  }
  return null;
}

async function main() {
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  const pending = [];
  for (const item of dataset.incidents) {
    for (const source of item.sources) {
      if (/^https?:\/\//i.test(source.url) && !source.archiveUrl) {
        pending.push({ incident: item.id, source });
      }
    }
  }

  const queue = pending.slice(0, limit);
  console.log(`${pending.length} sources lack an archiveUrl; processing ${queue.length}${dryRun ? ' (dry run)' : ''}`);

  let archived = 0;
  let captured = 0;
  const failures = [];

  for (const [index, entry] of queue.entries()) {
    const { incident, source } = entry;
    console.log(`[${index + 1}/${queue.length}] ${incident}: ${source.url}`);
    try {
      let snapshot = await findSnapshot(source.url);
      if (snapshot) {
        console.log(`  existing snapshot: ${snapshot}`);
      } else if (!dryRun) {
        await sleep(REQUEST_GAP_MS);
        snapshot = await requestCapture(source.url);
        if (snapshot) {
          captured += 1;
          console.log(`  new capture: ${snapshot}`);
        }
      }
      if (snapshot) {
        archived += 1;
        if (!dryRun) {
          source.archiveUrl = snapshot;
          fs.writeFileSync(DATASET_PATH, JSON.stringify(dataset, null, 2) + '\n');
        }
      } else {
        failures.push(source.url);
        console.log('  no snapshot available yet (re-run later)');
      }
    } catch (error) {
      failures.push(source.url);
      console.log(`  error: ${error.message}`);
    }
    await sleep(REQUEST_GAP_MS);
  }

  console.log(`\ndone: ${archived} sources archived (${captured} fresh captures), ${failures.length} unresolved`);
  for (const url of failures) console.log(`  unresolved: ${url}`);
  process.exitCode = 0;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
