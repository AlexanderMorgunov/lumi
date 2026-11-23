import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { responseHeaders, validateArtifact, sha256 } from './release-core.mjs';

const version = process.argv[2];
assert.match(version ?? '', /^\d+\.\d+\.\d+(?:-[a-z0-9][a-z0-9.-]{0,45})?$/);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = join(root, 'artifacts/releases', version);
const release = await validateArtifact(directory);
const files = new Map(
  release.files.map((file) => ['/' + release.prefix + file.path, file]),
);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  reducedMotion: 'reduce',
});
const errors = [];
let passed = false;
const requests = new Set();
const methods = [];
const entry = new URL('/__release-check', release.hostOrigin).href;
const fixture = `<!doctype html><html><head><title>Local release QA — no production traffic</title></head><body style="margin:0">
<iframe title="Lumi release" sandbox="allow-scripts allow-same-origin" style="width:100%;height:70vh;border:0" src=${JSON.stringify(release.entryUrl)}></iframe>
<script>
const config=${JSON.stringify({ gameId: release.gameId, releaseId: release.releaseId, gameOrigin: release.gameOrigin })};
const frame=document.querySelector('iframe'), launchId=crypto.randomUUID();
const send=(data)=>frame.contentWindow.postMessage({channel:'dayenglish.game',version:1,launchId,...data},config.gameOrigin);
const init=setInterval(()=>send({type:'init'}),250);
window.qaMethods=[];
addEventListener('message',e=>{
  const d=e.data;
  if(e.source!==frame.contentWindow||e.origin!==config.gameOrigin||d?.channel!=='dayenglish.game'||d.launchId!==launchId)return;
  if(d.type==='hello'){
    if(d.gameId!==config.gameId||d.releaseId!==config.releaseId)throw Error('Wrong compiled game identity');
    clearInterval(init);send({type:'ready',context:{gameId:config.gameId,releaseId:config.releaseId,locale:'ru',reducedMotion:true,capabilities:['view.window.v1'],view:{expanded:false}}});
  }
  if(d.type==='request'){
    window.qaMethods.push(d.method);
    if(d.method==='view.set'){
      frame.style.height=d.payload.expanded?'100dvh':'70vh';
      send({type:'response',requestId:d.requestId,result:{expanded:d.payload.expanded}});
      send({type:'event',event:{type:'view.changed',expanded:d.payload.expanded}});
    }else send({type:'response',requestId:d.requestId,error:{code:'not_available'}});
  }
});
</script></body></html>`;
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url());
  if (url.href === entry)
    return route.fulfill({ contentType: 'text/html', body: fixture });
  const file =
    url.origin === release.gameOrigin ? files.get(url.pathname) : null;
  if (!file) {
    errors.push(`Unexpected resource: ${url.origin}${url.pathname}`);
    return route.abort();
  }
  requests.add(file.path);
  return route.fulfill({
    status: 200,
    headers: {
      ...responseHeaders(release),
      'content-type': file.contentType,
      'cache-control': file.cacheControl,
    },
    body: await readFile(join(directory, 'site', file.path)),
  });
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
try {
  await page.goto(entry);
  const game = page.frameLocator('iframe');
  await game
    .getByRole('button', { name: 'На всё окно', exact: true })
    .waitFor({ timeout: 30000 });
  await game.getByRole('button', { name: 'На всё окно', exact: true }).click();
  await game
    .getByRole('button', { name: 'Свернуть игру', exact: true })
    .waitFor();
  await page.screenshot({ path: join(directory, 'browser-desktop.png') });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.screenshot({ path: join(directory, 'browser-phone.png') });
  await game
    .getByRole('button', { name: 'Свернуть игру', exact: true })
    .click();
  await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  const talk = game.getByRole('region', { name: 'Разговор с котом' });
  await talk.waitFor();
  while (
    await talk.getByRole('button', { name: 'Дальше', exact: true }).count()
  )
    await talk.getByRole('button', { name: 'Дальше', exact: true }).click();
  await talk
    .getByRole('button', { name: 'Сделать первый шаг', exact: true })
    .click();
  await expect(
    game.getByRole('group', { name: /^Игровое поле/ }),
  ).toHaveAttribute('data-scene-state', 'ready');
  await page.screenshot({ path: join(directory, 'browser-workshop.png') });
  methods.push(...(await page.evaluate(() => window.qaMethods)));
  assert(methods.filter((method) => method === 'view.set').length >= 2);
  assert(
    [...requests].some(
      (path) => path.endsWith('.mp3') || path.endsWith('.wav'),
    ),
    'No audio exercised',
  );
  assert([...requests].some((path) => path.includes('forest')));
  assert.deepEqual(errors, []);
  passed = true;
  console.log(
    `Built release browser check passed: ${requests.size} resources; nested path, CSP, SDK, desktop/phone, workshop.`,
  );
} finally {
  await writeFile(
    join(directory, 'browser-results.json'),
    JSON.stringify(
      {
        passed,
        manifestSha256: sha256(await readFile(join(directory, 'release.json'))),
        fixture:
          'Local route interception only; actual built game; no production traffic',
        errors,
        requests: [...requests],
        methods,
      },
      null,
      2,
    ),
  );
  await browser.close();
}
