import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Read the installed authoring tool only; never import/write OxfordEnglish content.
const source = resolve(
  process.argv[2] ?? '../OxfordEnglish/tools/content-forge/vendor',
);
const binary = resolve(source, 'piper/piper.exe');
const model = resolve(source, 'voices/en_US-lessac-medium.onnx');
const words = [
  'a',
  'am',
  'an',
  'apple',
  'apples',
  'be',
  'book',
  'cat',
  'cats',
  'egg',
  'eggs',
  'i',
  'key',
  'lumi',
  'orange',
  'robot',
  'the',
  'to',
  'umbrella',
  'water',
];
const directory = 'public/audio/en-US/lessac-v1';
mkdirSync(directory, { recursive: true });
const hash = (data) => createHash('sha256').update(data).digest('hex');
const assets = words.map((word) => {
  const text = (word === 'i' ? 'I' : word === 'lumi' ? 'Lumi' : word) + '.';
  const path = `${directory}/${word}.wav`;
  execFileSync(
    binary,
    [
      '--model',
      model,
      '--output_file',
      resolve(path),
      '--length_scale',
      '1',
      '--sentence_silence',
      '0.12',
      '--quiet',
    ],
    { input: text, encoding: 'utf8' },
  );
  const data = readFileSync(path);
  return { word, text, path, bytes: data.length, sha256: hash(data) };
});
writeFileSync(
  'docs/design/listening/audio-manifest.json',
  JSON.stringify(
    {
      date: new Date().toISOString().slice(0, 10),
      engine: 'Piper (installed OxfordEnglish content-forge authoring binary)',
      voice: 'en_US-lessac-medium',
      sampleRate: 22050,
      parameters: { length_scale: 1, sentence_silence: 0.12 },
      binarySha256: hash(readFileSync(binary)),
      modelSha256: hash(readFileSync(model)),
      modelCard:
        'https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/lessac/medium/MODEL_CARD',
      source:
        'Same local binary/model used by OxfordEnglish/tools/content-forge/story/build-episode.mjs; no sibling source or model bundled.',
      synthetic: true,
      assets,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Generated ${assets.length} Piper recordings (${assets.reduce((sum, a) => sum + a.bytes, 0)} bytes).`,
);
