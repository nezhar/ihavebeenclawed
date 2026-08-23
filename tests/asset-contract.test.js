'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync('index.html', 'utf8');
const dataset = JSON.parse(fs.readFileSync('incidents.json', 'utf8'));
const htmlImages = Array.from(
  html.matchAll(/(?:src|content)="(?:\.\/|https:\/\/ihavebeenclawed\.com\/)?(assets\/images\/[^"}]+\.png)"/g),
  (match) => match[1]
);
const dataImages = dataset.incidents.map((incident) => incident.image).filter(Boolean);
const images = [...new Set([...htmlImages, ...dataImages])];

test('all fourteen semantic image assets are referenced and exist', () => {
  assert.deepEqual(images.sort(), [
    'assets/images/cat-chaos-printer.png',
    'assets/images/cat-enter-key.png',
    'assets/images/cat-network-cable.png',
    'assets/images/cat-power-button.png',
    'assets/images/cat-usb-drive.png',
    'assets/images/claw-closeup.png',
    'assets/images/clawed-access-card.png',
    'assets/images/clawed-chatbot-phone.png',
    'assets/images/clawed-external-drive.png',
    'assets/images/clawed-headset.png',
    'assets/images/clawed-laptop-reflection.png',
    'assets/images/clawed-router.png',
    'assets/images/og-card.png',
    'assets/images/scratched-keyboard-hand.png'
  ]);
  for (const image of images) {
    assert.equal(fs.existsSync(path.resolve(image)), true, image);
  }
});

test('active content has no generated upload paths', () => {
  const active = html + JSON.stringify(dataset);
  assert.doesNotMatch(active, /uploads\/|ChatGPT Image/);
});
