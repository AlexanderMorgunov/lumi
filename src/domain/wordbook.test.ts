import { expect, it } from 'vitest';
import { allWords, roomTerms, wordbook } from './wordbook';
import { levels, type LevelDefinition } from './levels';
import { createPuzzle } from './puzzle';
import { recordedTerm } from './pronunciation';

it('covers the words on every authored board, including continuation rooms, with pronunciation', () => {
  const authored = new Set<string>();
  for (const root of Object.values(levels)) {
    for (
      let level: LevelDefinition | undefined = root;
      level;
      level = level.continuation
    )
      for (const piece of level.pieces)
        if (piece.kind === 'word') authored.add(piece.word);
  }
  expect(new Set(allWords)).toEqual(authored);
  for (const term of allWords) {
    expect(
      Boolean(recordedTerm(term)) ||
        ('audioPending' in wordbook[term] && wordbook[term].audioPending),
    ).toBe(true);
    expect(wordbook[term].translation).toBeTruthy();
    expect(wordbook[term].note).toBeTruthy();
  }
});

it('keeps the current request narrow without hiding the rest of the catalogue', () => {
  expect(roomTerms(createPuzzle('cat'))).toEqual(['cat', 'a']);
  expect(roomTerms(createPuzzle('theKey'))).toEqual(['key', 'a', 'the']);
  expect(allWords).toEqual([
    'He',
    "He's",
    'How',
    'I',
    "I'm",
    'It',
    "It's",
    'Lumi',
    'Marta',
    'No',
    'She',
    "She's",
    'They',
    "They're",
    'Tik',
    'We',
    "We're",
    'What',
    'Where',
    'Who',
    'Yes',
    'You',
    "You're",
    'a',
    'am',
    'an',
    'apple',
    'apples',
    'are',
    "aren't",
    'at',
    'book',
    'books',
    'box',
    'boxes',
    'cat',
    'child',
    'children',
    'egg',
    'eggs',
    'eight',
    'here',
    'is',
    "isn't",
    'key',
    'keys',
    'lantern',
    'not',
    'old',
    'orange',
    'people',
    'person',
    'ready',
    'robot',
    'robots',
    'six',
    'station',
    'stories',
    'story',
    'the',
    'two',
    'umbrella',
    'years',
  ]);
});
