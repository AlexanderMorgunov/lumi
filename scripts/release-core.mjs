import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

export const endpoint = 'https://storage.yandexcloud.net';
export const immutable = 'public,max-age=31536000,immutable';
export function responseHeaders(release) {
  return {
    'content-security-policy': `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors ${release.hostOrigin}`,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
  };
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.vtt': 'text/vtt; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};
export const sha256 = (data) => createHash('sha256').update(data).digest('hex');
export function validateConfig(config, version) {
  assert.match(
    version,
    /^\d+\.\d+\.\d+(?:-[a-z0-9][a-z0-9.-]{0,45})?$/,
    'Use a release such as 1.0.0 or 1.0.0-rc.1',
  );
  assert(config && typeof config === 'object' && !Array.isArray(config));
  const fields = [
    'gameId',
    'title',
    'hostOrigin',
    'gameOrigin',
    'bucket',
    'resources',
  ];
  assert.deepEqual(
    Object.keys(config).sort(),
    fields.sort(),
    'Unexpected or missing release configuration fields',
  );
  assert.match(config.gameId, /^[a-z][a-z0-9-]{0,79}$/);
  assert(config.gameId !== 'submit');
  assert(
    typeof config.title === 'string' &&
      config.title.length > 0 &&
      config.title.length <= 120,
  );
  for (const value of [config.hostOrigin, config.gameOrigin]) {
    const url = new URL(value);
    assert(
      url.protocol === 'https:' &&
        url.origin === value &&
        !url.port &&
        !url.username &&
        !url.password,
      'Use exact HTTPS origins without paths, ports or credentials',
    );
  }
  assert.notEqual(
    config.hostOrigin,
    config.gameOrigin,
    'The game must have its own origin',
  );
  assert.equal(
    config.bucket,
    'dayenglish-games',
    'Use the shared games bucket; application and private buckets are forbidden',
  );
  assert.match(config.bucket, /^(?=.{3,63}$)[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
  assert(
    Array.isArray(config.resources) &&
      config.resources.length > 0 &&
      config.resources.length <= 100,
  );
  const ids = new Set();
  for (const resource of config.resources) {
    assert.deepEqual(Object.keys(resource).sort(), ['access', 'id']);
    assert.match(resource.id, /^[a-z][a-z0-9-]{0,79}$/);
    assert.equal(
      resource.access,
      'public',
      'This pipeline uploads public content only. Protected chapters need separate private delivery.',
    );
    assert(!ids.has(resource.id), 'Duplicate resource');
    ids.add(resource.id);
  }
  return {
    ...config,
    releaseId: version,
    prefix: `games/${config.gameId}/releases/${version}/`,
    entryUrl: `${config.gameOrigin}/games/${config.gameId}/releases/${version}/index.html`,
  };
}
export async function inventory(root) {
  const files = [];
  async function walk(relative = '') {
    const info = await lstat(join(root, relative));
    assert(!info.isSymbolicLink(), 'Symlinks cannot be published');
    if (info.isDirectory()) {
      for (const name of (await readdir(join(root, relative))).sort()) {
        assert.match(
          name,
          /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
          'Unsafe artifact filename',
        );
        await walk(relative ? `${relative}/${name}` : name);
      }
      return;
    }
    assert(
      info.isFile() && info.size < 500_000_000,
      'Unsupported file or file exceeds 500 MB',
    );
    const contentType = types[extname(relative)];
    assert(
      contentType && !relative.endsWith('.map'),
      `Unexpected public file: ${relative}`,
    );
    const bytes = await readFile(join(root, relative));
    files.push({
      path: relative,
      size: bytes.length,
      sha256: sha256(bytes),
      contentType,
      cacheControl: relative.endsWith('.html') ? 'no-cache' : immutable,
    });
  }
  await walk();
  assert(
    files.some((file) => file.path === 'index.html'),
    'Missing index.html',
  );
  return files;
}
export async function checkReferences(root, files, prefix) {
  const paths = new Set(files.map((file) => file.path));
  const base = new URL(`https://release.invalid/${prefix}`);
  const check = (reference, source) => {
    if (/^(data:|blob:|#)/.test(reference)) return;
    const target = new URL(reference, new URL(source, base));
    assert.equal(target.origin, base.origin, `External resource in ${source}`);
    assert(
      target.pathname.startsWith(base.pathname),
      `Resource escapes the release: ${reference}`,
    );
    assert(
      paths.has(
        decodeURIComponent(target.pathname.slice(base.pathname.length)),
      ),
      `Missing resource: ${reference}`,
    );
  };
  for (const file of files) {
    if (!/\.(css|html|js)$/.test(file.path)) continue;
    const source = await readFile(join(root, file.path), 'utf8');
    assert(!/sourceMappingURL=/.test(source), 'Source maps must not ship');
    if (file.path.endsWith('.css')) {
      for (const match of source.matchAll(
        /url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g,
      ))
        check(match[1], file.path);
    } else if (file.path.endsWith('.html')) {
      for (const match of source.matchAll(/(?:src|href)=["']([^"']+)["']/g))
        check(match[1], file.path);
    } else {
      // Bundled voice manifests retain complete asset paths; catch missing late-chapter media too.
      for (const match of source.matchAll(
        /["']((?:\/?(?:art|audio|video|fonts)\/)[a-zA-Z0-9_./-]+\.(?:png|jpg|webp|svg|mp3|wav|ogg|mp4|webm|vtt|woff2?))["']/g,
      )) {
        check(match[1], 'index.html');
      }
    }
  }
}
export async function validateArtifact(directory) {
  const manifest = JSON.parse(
    await readFile(join(directory, 'release.json'), 'utf8'),
  );
  assert.equal(
    manifest.format,
    2,
    'Rebuild legacy artifacts for shared hosting',
  );
  const release = validateConfig(manifest.config, manifest.releaseId);
  const files = await inventory(join(directory, 'site'));
  assert.deepEqual(
    files,
    manifest.files,
    'Artifact differs from its SHA-256 inventory; rebuild with a new version',
  );
  await checkReferences(join(directory, 'site'), files, release.prefix);
  return { ...release, files };
}
export function uploadPlan(release) {
  return [...release.files]
    .sort((a, b) => {
      if (a.path === 'index.html') return 1;
      if (b.path === 'index.html') return -1;
      return a.path.localeCompare(b.path);
    })
    .map((file) => ({ ...file, key: release.prefix + file.path }));
}
export async function validateBrowserCheck(directory) {
  const report = JSON.parse(
    await readFile(join(directory, 'browser-results.json'), 'utf8'),
  );
  assert.equal(
    report.passed,
    true,
    'Run release:browser for this artifact before uploading',
  );
  assert.deepEqual(report.errors, [], 'Browser verification has errors');
  assert.equal(
    report.manifestSha256,
    sha256(await readFile(join(directory, 'release.json'))),
    'Browser verification belongs to a different artifact',
  );
}
export async function uploadRelease(directory, release, store) {
  assert.equal(
    (await store.list(release.prefix)).length,
    0,
    'Release prefix already exists. Use a new release version.',
  );
  const marker = Buffer.from(
    JSON.stringify({
      gameId: release.gameId,
      releaseId: release.releaseId,
      entryUrl: release.entryUrl,
    }),
  );
  // Reservation is conditional too: simultaneous publishers cannot mix their builds.
  await store.put({
    key: `${release.prefix}_upload.json`,
    bytes: marker,
    contentType: 'application/json',
    cacheControl: 'no-cache',
    sha256: sha256(marker),
  });
  for (const file of uploadPlan(release)) {
    const bytes = await readFile(join(directory, 'site', file.path));
    assert.equal(sha256(bytes), file.sha256, 'Artifact changed during upload');
    await store.put({ ...file, bytes });
    const remote = await store.head(file.key);
    assert.equal(remote.size, file.size, 'Remote size mismatch');
    assert.equal(
      remote.sha256,
      file.sha256,
      'Remote checksum metadata mismatch',
    );
    assert.equal(remote.contentType, file.contentType, 'Remote MIME mismatch');
    assert.equal(
      remote.cacheControl,
      file.cacheControl,
      'Remote caching mismatch',
    );
  }
}
export async function verifyRemote(release, fetcher = fetch) {
  for (const file of release.files) {
    const response = await fetcher(
      new URL(file.key ?? release.prefix + file.path, release.gameOrigin + '/'),
      {
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(60000),
      },
    );
    assert.equal(
      response.status,
      200,
      `HTTP verification failed: ${file.path}`,
    );
    if (file.path === 'index.html') {
      for (const [name, value] of Object.entries(responseHeaders(release))) {
        assert.equal(
          response.headers.get(name),
          value,
          `Missing or unexpected security header: ${name}`,
        );
      }
      assert(
        !response.headers.get('x-frame-options'),
        'X-Frame-Options must not block the DayEnglish iframe; use frame-ancestors',
      );
    }
    assert.equal(
      response.headers.get('content-type')?.toLowerCase(),
      file.contentType.toLowerCase(),
      `Wrong MIME: ${file.path}`,
    );
    assert.equal(
      response.headers.get('cache-control'),
      file.cacheControl,
      `Wrong cache policy: ${file.path}`,
    );
    assert.equal(
      sha256(Buffer.from(await response.arrayBuffer())),
      file.sha256,
      `Wrong bytes: ${file.path}`,
    );
  }
}
