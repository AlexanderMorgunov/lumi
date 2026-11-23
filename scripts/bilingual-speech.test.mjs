import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bilingualSpeech } from './lib/bilingual-speech.mjs';

test('preserves whole English examples, question intonation and contractions', () => {
  const text =
    'I am a robot. I’m Lumi. You’re a robot. Are you ready? Ответь Yes, I am.';
  assert.equal(bilingualSpeech(text), text);
});
test('distinguishes isolated letters and pronouns from an article in a phrase', () => {
  assert.equal(
    bilingualSpeech('I, you и it. Буква i из is. Артикль a в a robot.'),
    '/aɪ/, you и it. Буква /aɪ/ из is. Артикль /eɪ/ в a robot.',
  );
  assert.equal(
    bilingualSpeech('После x добавляем -es: box → boxes.'),
    'После /ɛks/ добавляем /iː/ /ɛs/: box превращается в boxes.',
  );
});
test('names spelling endings without changing their example words', () => {
  assert.equal(
    bilingualSpeech('y меняется на ies: story → stories. Перед y стоит r.'),
    '/waɪ/ меняется на /aɪ/ /iː/ /ɛs/: story превращается в stories. Перед /waɪ/ стоит /ɑːr/.',
  );
  assert.equal(
    bilingualSpeech('Children и people без -s.'),
    'Children и people без /ɛs/.',
  );
});
test('expands visual notation and stress without adding automatic filler', () => {
  const text = bilingualSpeech(
    'Aren’t = are not. a/an. Апостроф. В I am Marta говорит Марта.',
  );
  assert.equal(
    text,
    'Aren’t означает то же, что are not. /eɪ/ или an. Апостро́ф. В предложении I am Marta говорит Марта.',
  );
  assert.ok(!text.includes('в записи'));
});
