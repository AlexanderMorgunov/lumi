import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  checkReferences,
  endpoint,
  inventory,
  responseHeaders,
  uploadPlan,
  uploadRelease,
  validateArtifact,
  validateBrowserCheck,
  validateConfig,
  verifyRemote,
} from './release-core.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const help = `Prepare: npm run release -- prepare --version 1.0.0 --config release.config.example.json
Inspect: npm run release -- inspect --version 1.0.0
Upload preview: npm run release -- upload --version 1.0.0
Upload: npm run release -- upload --version 1.0.0 --execute --confirm-bucket dayenglish-games
Verify public HTTPS: npm run release -- verify --version 1.0.0
Browser check (no network): npm run release:browser -- 1.0.0
Nothing changes the active DayEnglish catalogue. See docs/RELEASING.md.`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      version: { type: 'string' },
      config: { type: 'string' },
      execute: { type: 'boolean', default: false },
      'confirm-bucket': { type: 'string' },
      help: { type: 'boolean' },
    },
  });
  if (values.help) {
    console.log(help);
    return;
  }
  assert(
    positionals.length === 1 &&
      ['prepare', 'inspect', 'upload', 'verify'].includes(positionals[0]),
    help,
  );
  const [command] = positionals;
  assert.match(
    values.version ?? '',
    /^\d+\.\d+\.\d+(?:-[a-z0-9][a-z0-9.-]{0,45})?$/,
    'Missing or invalid --version',
  );
  assert(
    !values.execute || command === 'upload',
    '--execute is only valid for upload',
  );
  assert(
    !values.config || command === 'prepare',
    '--config is only used by prepare',
  );
  const directory = join(root, 'artifacts', 'releases', values.version);
  if (command === 'prepare') {
    assert(values.config, 'Provide --config explicitly');
    const config = JSON.parse(
      await readFile(resolve(root, values.config), 'utf8'),
    );
    const release = validateConfig(config, values.version);
    const check = spawnSync(
      process.execPath,
      [join(root, 'node_modules/typescript/bin/tsc'), '--noEmit'],
      { cwd: root, stdio: 'inherit' },
    );
    assert.equal(check.status, 0, 'TypeScript check failed');
    await mkdir(dirname(directory), { recursive: true });
    await mkdir(directory);
    const { build } = await import('vite');
    const client = {
      VITE_PLATFORM_MODE: 'dayenglish',
      VITE_DAYENGLISH_HOST_ORIGIN: release.hostOrigin,
      VITE_DAYENGLISH_GAME_ID: release.gameId,
      VITE_DAYENGLISH_RELEASE_ID: release.releaseId,
    };
    await build({
      root,
      base: '/' + release.prefix,
      envDir: false,
      envPrefix: [],
      define: Object.fromEntries(
        Object.entries(client).map(([key, value]) => [
          `import.meta.env.${key}`,
          JSON.stringify(value),
        ]),
      ),
      build: {
        outDir: join(directory, 'site'),
        emptyOutDir: false,
        sourcemap: false,
      },
    });
    const files = await inventory(join(directory, 'site'));
    await checkReferences(join(directory, 'site'), files, release.prefix);
    await writeFile(
      join(directory, 'release.json'),
      JSON.stringify(
        {
          format: 2,
          config,
          releaseId: release.releaseId,
          createdAt: new Date().toISOString(),
          files,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    await writeFile(
      join(directory, 'catalog-entry.json'),
      JSON.stringify(
        {
          gameId: release.gameId,
          releaseId: release.releaseId,
          title: release.title,
          entryUrl: release.entryUrl,
          skills: [],
          resources: config.resources,
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
  }
  const release = await validateArtifact(directory);
  console.log(
    JSON.stringify(
      {
        gameId: release.gameId,
        releaseId: release.releaseId,
        bucket: release.bucket,
        entryUrl: release.entryUrl,
        files: release.files.length,
        bytes: release.files.reduce((sum, file) => sum + file.size, 0),
      },
      null,
      2,
    ),
  );
  if (command === 'prepare')
    await writeFile(
      join(directory, 'response-headers.json'),
      JSON.stringify(responseHeaders(release), null, 2) + '\n',
      { flag: 'wx' },
    );
  if (command === 'upload') {
    if (!values.execute) {
      console.log(
        `DRY RUN: ${uploadPlan(release).length} conditional uploads; index.html last. No cloud requests made.`,
      );
      return;
    }
    assert.equal(
      values['confirm-bucket'],
      release.bucket,
      'Provide the exact --confirm-bucket',
    );
    await validateBrowserCheck(directory);
    const {
      S3Client,
      ListObjectsV2Command,
      PutObjectCommand,
      HeadObjectCommand,
    } = await import('@aws-sdk/client-s3');
    const client = new S3Client({
      endpoint,
      region: 'ru-central1',
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    const store = {
      async list(prefix) {
        return (
          (
            await client.send(
              new ListObjectsV2Command({
                Bucket: release.bucket,
                Prefix: prefix,
                MaxKeys: 1,
              }),
            )
          ).Contents ?? []
        );
      },
      async put(file) {
        await client.send(
          new PutObjectCommand({
            Bucket: release.bucket,
            Key: file.key,
            Body: file.bytes,
            ContentMD5: createHash('md5').update(file.bytes).digest('base64'),
            ContentType: file.contentType,
            CacheControl: file.cacheControl,
            Metadata: { sha256: file.sha256 },
            IfNoneMatch: '*',
          }),
        );
      },
      async head(key) {
        const head = await client.send(
          new HeadObjectCommand({ Bucket: release.bucket, Key: key }),
        );
        return {
          size: head.ContentLength,
          sha256: head.Metadata?.sha256,
          contentType: head.ContentType,
          cacheControl: head.CacheControl,
        };
      },
    };
    try {
      await uploadRelease(directory, release, store);
    } finally {
      client.destroy();
    }
    console.log(
      'Uploaded. The public catalogue has NOT changed. Run verify, browser checks, then activate separately.',
    );
  }
  if (command === 'verify') {
    await verifyRemote(release);
    console.log(
      'Public files verified byte-for-byte. Catalogue activation is still separate.',
    );
  }
}
main().catch((error) => {
  // Provider errors may contain request details. Never dump credentials or response objects.
  console.error(
    error.name === 'AssertionError'
      ? error.message
      : `Release failed (${error.code ?? error.name}). No release is overwritten; see docs/RELEASING.md.`,
  );
  process.exitCode = 1;
});
