import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
const root = 'artifacts/voice/station-english-fixes-2026-11-19/hmr-after';
await mkdir(root, { recursive: true });
await copyFile('src/game/cat-mouth.ts', root + '/cat-mouth.ts');
const save = (name, clips) =>
  writeFile(root + '/' + name, JSON.stringify({ step: 0.08, clips }));
await save('cat-mouth-cues.json', [
  { file: 'audio/cat/cat.mp3', frames: '10' },
]);
await save('station-mouth-cues.json', [
  { file: 'audio/station/old.mp3', frames: '10' },
]);
await writeFile(
  root + '/index.html',
  `<script type="module">import {catMouthAt} from '/cat-mouth.ts';window.storedReader=catMouthAt;window.marker=Math.random();import.meta.hot.accept('/cat-mouth.ts',()=>{});</script>`,
);
const server = await createServer({
  configFile: false,
  root: path.resolve(root),
  server: { host: 'localhost', port: 4293, strictPort: true },
  logLevel: 'error',
});
await server.listen();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4293');
  await page.waitForFunction(() => typeof window.storedReader === 'function');
  const marker = await page.evaluate(() => window.marker);
  await save('station-mouth-cues.json', [
    { file: 'audio/station/new.mp3', frames: '01' },
  ]);
  await page.waitForFunction(
    () => window.storedReader('audio/station/new.mp3', 0.04) === 'closed',
  );
  const station = await page.evaluate(() => ({
    old: window.storedReader('audio/station/old.mp3', 0.04),
    newClosed: window.storedReader('audio/station/new.mp3', 0.04),
    newOpen: window.storedReader('audio/station/new.mp3', 0.12),
    catUnchanged: window.storedReader('audio/cat/cat.mp3', 0.04),
    marker: window.marker,
  }));
  if (
    station.old !== 'rest' ||
    station.newOpen !== 'open' ||
    station.catUnchanged !== 'open' ||
    station.marker !== marker
  )
    throw new Error('Station HMR regression');
  await save('cat-mouth-cues.json', [
    { file: 'audio/cat/cat.mp3', frames: '01' },
  ]);
  await page.waitForFunction(
    () => window.storedReader('audio/cat/cat.mp3', 0.04) === 'closed',
  );
  const cat = await page.evaluate(() => ({
    cat: window.storedReader('audio/cat/cat.mp3', 0.04),
    stationUnchanged: window.storedReader('audio/station/new.mp3', 0.12),
    marker: window.marker,
  }));
  if (cat.stationUnchanged !== 'open' || cat.marker !== marker)
    throw new Error('Cat HMR regression');
  await writeFile(
    root + '/result.json',
    JSON.stringify(
      { station, cat, keptStoredFunction: true, noReload: true },
      null,
      2,
    ),
  );
  console.log(
    'PASS: stored mouth reader follows both HMR timelines, old URL removed, no reload',
  );
} finally {
  await browser.close();
  await server.close();
}
