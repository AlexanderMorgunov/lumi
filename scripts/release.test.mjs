import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import {
  checkReferences,
  inventory,
  responseHeaders,
  uploadRelease,
  validateArtifact,
  validateBrowserCheck,
  sha256,
  validateConfig,
  verifyRemote,
} from './release-core.mjs';

const config = {
  gameId: 'lumi',
  title: 'Lumi',
  hostOrigin: 'https://app.example.test',
  gameOrigin: 'https://lumi.example.test',
  bucket: 'dayenglish-games',
  resources: [{ id: 'chapter-1', access: 'public' }],
};
test('shared hosting separates equal versions by game identity', () => {
  const shared = { ...config, bucket: 'dayenglish-games' };
  const first = validateConfig(shared, '1.0.0');
  const second = validateConfig(
    {
      ...shared,
      gameId: 'station',
      gameOrigin: 'https://station.example.test',
    },
    '1.0.0',
  );
  assert.equal(first.prefix, 'games/lumi/releases/1.0.0/');
  assert.equal(second.prefix, 'games/station/releases/1.0.0/');
  assert.notEqual(first.prefix, second.prefix);
  assert.equal(
    first.entryUrl,
    `${shared.gameOrigin}/${first.prefix}index.html`,
  );
  for (const gameId of ['../station', 'lumi/../station', '', 'Lumi', 'lumi?x'])
    assert.throws(() => validateConfig({ ...shared, gameId }, '1.0.0'));
});
async function fixture(t, gameConfig = config) {
  const directory = await mkdtemp(join(tmpdir(), 'lumi-release-'));
  t.after(() => {
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert(basename(directory).startsWith('lumi-release-'));
    return rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, 'site', 'assets'), { recursive: true });
  await writeFile(
    join(directory, 'site/index.html'),
    `<script src="/${validateConfig(gameConfig, '1.0.0').prefix}assets/game.js"></script>`,
  );
  await writeFile(
    join(directory, 'site/assets/game.js'),
    'console.log("game");',
  );
  const files = await inventory(join(directory, 'site'));
  await writeFile(
    join(directory, 'release.json'),
    JSON.stringify({
      format: 2,
      config: gameConfig,
      releaseId: '1.0.0',
      files,
    }),
  );
  return { directory, release: await validateArtifact(directory) };
}
function fakeStore(failAt) {
  const objects = new Map();
  const calls = [];
  return {
    objects,
    calls,
    async list(prefix) {
      return [...objects.keys()].filter((key) => key.startsWith(prefix));
    },
    async put(file) {
      assert(!objects.has(file.key), 'PreconditionFailed');
      if (file.key === failAt) throw new Error('Disconnected');
      calls.push(file.key);
      objects.set(file.key, { ...file, size: file.bytes.length });
    },
    async head(key) {
      return objects.get(key);
    },
  };
}
test('rejects unsafe versions, shared origins, unexpected config and wrong buckets', () => {
  for (const id of ['../1', '1/2', '1.0.0/../2', '--help', '1.0.0?x'])
    assert.throws(() => validateConfig(config, id));
  for (const patch of [
    { gameOrigin: config.hostOrigin },
    { hostOrigin: 'http://dayenglish.ru' },
    { bucket: 'dayenglish.ru' },
    { token: 'must-not-be-here' },
    { gameOrigin: 'https://user:pass@lumi.example.test' },
  ])
    assert.throws(() => validateConfig({ ...config, ...patch }, '1.0.0'));
});
test('rejects artifact tampering and unlisted files', async (t) => {
  const { directory } = await fixture(t);
  await writeFile(join(directory, 'site/assets/game.js'), 'changed');
  await assert.rejects(validateArtifact(directory), /differs/);
  await writeFile(join(directory, 'site/.env'), 'SECRET');
  await assert.rejects(validateArtifact(directory), /Unsafe/);
});
test('rejects legacy manifests instead of redirecting them to new object keys', async (t) => {
  const { directory } = await fixture(t);
  const path = join(directory, 'release.json');
  const manifest = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...manifest, format: 1 }));
  await assert.rejects(validateArtifact(directory), /Rebuild legacy/);
});
test('publishes two games with identical versions without collision', async (t) => {
  const first = await fixture(t);
  const second = await fixture(t, {
    ...config,
    gameId: 'station',
    gameOrigin: 'https://station.example.test',
  });
  const store = fakeStore();
  await Promise.all([
    uploadRelease(first.directory, first.release, store),
    uploadRelease(second.directory, second.release, store),
  ]);
  assert(store.objects.has('games/lumi/releases/1.0.0/index.html'));
  assert(store.objects.has('games/station/releases/1.0.0/index.html'));
  assert.equal(store.objects.size, 6);
});
test('upload requires a successful browser check bound to this artifact', async (t) => {
  const { directory } = await fixture(t);
  const report = {
    passed: true,
    errors: [],
    manifestSha256: sha256(await readFile(join(directory, 'release.json'))),
  };
  await writeFile(
    join(directory, 'browser-results.json'),
    JSON.stringify(report),
  );
  await validateBrowserCheck(directory);
  await writeFile(
    join(directory, 'browser-results.json'),
    JSON.stringify({ ...report, manifestSha256: 'stale' }),
  );
  await assert.rejects(validateBrowserCheck(directory), /different artifact/);
  await writeFile(
    join(directory, 'browser-results.json'),
    JSON.stringify({ ...report, passed: false }),
  );
  await assert.rejects(validateBrowserCheck(directory), /release:browser/);
});
test('rejects root-relative and missing assets for versioned hosting', async (t) => {
  const { directory, release } = await fixture(t);
  for (const path of [
    '/art/missing.png',
    '/games/lumi/releases/1.0.0/missing.png',
    'https://third-party.test/script.js',
  ]) {
    await writeFile(
      join(directory, 'site/index.html'),
      `<script src="${path}"></script>`,
    );
    await assert.rejects(
      checkReferences(join(directory, 'site'), release.files, release.prefix),
    );
  }
});
test('publishes index last and refuses duplicate releases', async (t) => {
  const { directory, release } = await fixture(t);
  const store = fakeStore();
  await uploadRelease(directory, release, store);
  assert.equal(store.calls[0], 'games/lumi/releases/1.0.0/_upload.json');
  assert.equal(store.calls.at(-1), 'games/lumi/releases/1.0.0/index.html');
  const count = store.calls.length;
  await assert.rejects(
    uploadRelease(directory, release, store),
    /already exists/,
  );
  assert.equal(store.calls.length, count);
});
test('detects a missing audio file referenced by the bundled voice manifest', async (t) => {
  const { directory, release } = await fixture(t);
  await writeFile(
    join(directory, 'site/assets/game.js'),
    'const clips=[{file:"audio/station/missing.mp3"}];',
  );
  await assert.rejects(
    checkReferences(join(directory, 'site'), release.files, release.prefix),
    /Missing resource/,
  );
});
test('interrupted release does not publish entry point and cannot be overwritten', async (t) => {
  const { directory, release } = await fixture(t);
  const store = fakeStore('games/lumi/releases/1.0.0/assets/game.js');
  await assert.rejects(
    uploadRelease(directory, release, store),
    /Disconnected/,
  );
  assert(!store.objects.has('games/lumi/releases/1.0.0/index.html'));
  await assert.rejects(
    uploadRelease(directory, release, store),
    /already exists/,
  );
});
test('conditional reservation rejects a racing publisher', async (t) => {
  const { directory, release } = await fixture(t);
  const store = fakeStore();
  store.list = async () => [];
  const result = await Promise.allSettled([
    uploadRelease(directory, release, store),
    uploadRelease(directory, release, store),
  ]);
  assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(
    store.calls.filter((key) => key.endsWith('index.html')).length,
    1,
  );
});
test('public verification rejects MIME mismatch and corrupt bytes', async (t) => {
  const { directory, release } = await fixture(t);
  const fetcher = async (url) => {
    const file = release.files.find(
      (item) => url.pathname === '/' + release.prefix + item.path,
    );
    return new Response(await readFile(join(directory, 'site', file.path)), {
      headers: {
        ...responseHeaders(release),
        'content-type': file.contentType,
        'cache-control': file.cacheControl,
      },
    });
  };
  await verifyRemote(release, fetcher);
  await assert.rejects(
    verifyRemote(
      release,
      async () =>
        new Response('wrong', {
          headers: {
            ...responseHeaders(release),
            'content-type': 'text/plain',
          },
        }),
    ),
    /MIME/,
  );
  await assert.rejects(
    verifyRemote(release, async (url) => {
      const response = await fetcher(url);
      return new Response('corrupted bytes', { headers: response.headers });
    }),
    /Wrong bytes/,
  );
  await assert.rejects(
    verifyRemote(release, async (url) => {
      const response = await fetcher(url);
      response.headers.delete('content-security-policy');
      return response;
    }),
    /security header/,
  );
});
