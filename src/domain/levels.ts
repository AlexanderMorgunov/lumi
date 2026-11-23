import { episodes, type EpisodeId } from './episodes';
import { closingLevels } from './closing-chapter';
import { stationLevel, type MessageContext } from './station-chapter';
import { stationIdentityLevel } from './station-identity';
import { stationAddressLevel } from './station-address';
import { stationThirdLevel } from './station-third-person';
import { stationObjectsLevel } from './station-objects';
import { stationNextLevels } from './station-next';
import { departureLevels } from './station-departure';
import { finaleLevels } from './station-finale';

export type Position = { x: number; y: number };
export type DialogueSpeaker = 'cat' | 'tik' | 'marta' | 'lumi';
// Physical identity is independent of text: two tiles may both say "a".
export type Piece = Position &
  ({ id: string; kind: 'word'; word: string } | { id: string; kind: 'crate' });
export type ReferenceObject = {
  id: string;
  noun: string;
  label: string;
  color?: 'green' | 'red';
  count?: 2;
  display?: 'card' | 'record';
  // A passenger/cargo record is text, never text baked into artwork.
  caption?: string;
};
export type LevelDefinition = {
  id: string;
  revision: number;
  continuation?: LevelDefinition;
  carryReference?: boolean;
  message?: MessageContext;
  presentation?: {
    title: string;
    noun: string;
    quest: string;
    introduction: readonly string[];
    success: readonly string[];
    speakers?: {
      task: readonly DialogueSpeaker[];
      success: readonly DialogueSpeaker[];
    };
    rule: string;
    hint: string;
    destination: 'bag' | 'door' | 'register';
    continuationAction?: string;
  };
  columns: number;
  rows: number;
  walls: readonly Position[];
  // Explicit reading order also supports longer / wrapped constructions.
  slots: readonly Position[];
  // Only authored plural-noun lessons may leave the article position empty.
  optionalLeadingArticle?: boolean;
  // A contracted first tile replaces two words; only the last slot may be empty.
  allowContractions?: boolean;
  start: Position;
  pieces: readonly Piece[];
  // Explicit pointing establishes shared reference before this lesson begins.
  reference?: {
    objects: readonly ReferenceObject[];
    indicatedId: string | null;
    markerLabel: string;
  };
  answers: readonly {
    words: readonly string[];
    goal: boolean;
    feedback?: string;
    referentId?: string;
    effect?:
      | { type: 'record-message'; destination?: never; target?: never }
      | {
          type: 'select' | 'deliver';
          target: 'any' | 'known';
          destination?: 'bag' | 'door';
        };
  }[];
  mistakes: readonly {
    words: readonly string[];
    reason: 'article' | 'mismatch' | 'agreement';
    feedback: string;
  }[];
};

function introductory(episode: 'cat' | 'key' | 'apple'): LevelDefinition {
  const { id, article, noun } = episodes[episode];
  return {
    id,
    revision: 1,
    columns: 5,
    rows: 3,
    walls: [{ x: 4, y: 0 }],
    slots: [
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    start: { x: 2, y: 2 },
    pieces: [
      {
        id: article,
        kind: 'word',
        word: article,
        x: 1,
        y: episode === 'key' ? 1 : 0,
      },
      {
        id: noun,
        kind: 'word',
        word: noun,
        x: episode === 'key' ? 3 : 2,
        y: 1,
      },
      { id: 'crate', kind: 'crate', x: 0, y: 1 },
    ],
    answers: [{ words: [article, noun], goal: true }],
    mistakes: [],
  };
}

export const levels: Record<EpisodeId, LevelDefinition> = {
  ...finaleLevels,
  ...departureLevels,
  ...stationNextLevels,
  'chapter-02-05': stationObjectsLevel,
  'chapter-02-04': stationThirdLevel,
  'chapter-02-03': stationAddressLevel,
  'chapter-02-02': stationIdentityLevel,
  'chapter-02-01': stationLevel,
  ...closingLevels,
  theApple: {
    id: 'chapter-01-07',
    revision: 1,
    columns: 7,
    rows: 4,
    walls: [{ x: 6, y: 0 }],
    slots: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
    start: { x: 4, y: 3 },
    pieces: [
      { id: 'a', kind: 'word', word: 'a', x: 1, y: 1 },
      { id: 'an', kind: 'word', word: 'an', x: 3, y: 1 },
      { id: 'the', kind: 'word', word: 'the', x: 5, y: 1 },
      { id: 'apple', kind: 'word', word: 'apple', x: 4, y: 2 },
    ],
    reference: {
      markerLabel: 'Для смотрителя',
      indicatedId: 'keeper-apple',
      objects: [
        {
          id: 'keeper-apple',
          noun: 'apple',
          color: 'green',
          label: 'Левое зелёное яблоко — подарок смотрителю',
        },
        {
          id: 'pantry-apple',
          noun: 'apple',
          label: 'Среднее яблоко — запас мастерской',
        },
        {
          id: 'workshop-apple',
          noun: 'apple',
          label: 'Правое яблоко — запас мастерской',
        },
      ],
    },
    answers: [
      { words: ['the', 'apple'], goal: true, referentId: 'keeper-apple' },
      {
        words: ['an', 'apple'],
        goal: false,
        feedback:
          'an apple — грамматически верное сочетание для одного любого яблока. Но нам нужно именно левое яблоко, указанное котом: the apple. Гласный звук не отменяет определённый артикль. Все яблоки пока остаются на столе; можно отменить ходы и заменить артикль.',
      },
    ],
    mistakes: [
      {
        words: ['a', 'apple'],
        reason: 'article',
        feedback:
          'a apple неверно по форме: перед гласным /æ/ неопределённый артикль имеет форму an. Но в этой просьбе нужен указанный обоим предмет — the apple. Яблоки остаются на столе. Можно отменить ходы и попробовать снова.',
      },
    ],
  },
  theKey: {
    id: 'chapter-01-06',
    revision: 1,
    columns: 7,
    rows: 4,
    walls: [{ x: 6, y: 0 }],
    slots: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
    start: { x: 4, y: 3 },
    pieces: [
      { id: 'a', kind: 'word', word: 'a', x: 1, y: 1 },
      { id: 'the', kind: 'word', word: 'the', x: 5, y: 1 },
      { id: 'key', kind: 'word', word: 'key', x: 4, y: 2 },
    ],
    reference: {
      markerLabel: 'Ключ от двери',
      objects: [
        { id: 'cupboard-key', noun: 'key', label: 'Левый ключ — от шкафа' },
        {
          id: 'workshop-key',
          noun: 'key',
          label: 'Средний ключ — от двери мастерской',
        },
        { id: 'chest-key', noun: 'key', label: 'Правый ключ — от сундука' },
      ],
      indicatedId: 'workshop-key',
    },
    answers: [
      { words: ['the', 'key'], goal: true, referentId: 'workshop-key' },
      {
        words: ['a', 'key'],
        goal: false,
        feedback:
          'a key — грамматически верное сочетание, но оно не указывает на нужный нам ключ. Кот просил именно средний ключ от двери, понятный вам обоим: the key. Пока все ключи остаются на столе. Можно отменить ходы и заменить артикль.',
      },
    ],
    mistakes: [],
  },
  cat: introductory('cat'),
  key: introductory('key'),
  apple: introductory('apple'),
  egg: {
    id: 'chapter-01-04',
    revision: 2,
    columns: 7,
    rows: 4,
    walls: [{ x: 6, y: 0 }],
    slots: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
    start: { x: 4, y: 3 },
    pieces: [
      { id: 'a', kind: 'word', word: 'a', x: 1, y: 1 },
      { id: 'an', kind: 'word', word: 'an', x: 5, y: 1 },
      { id: 'egg', kind: 'word', word: 'egg', x: 4, y: 2 },
    ],
    answers: [{ words: ['an', 'egg'], goal: true }],
    mistakes: [
      {
        words: ['a', 'egg'],
        reason: 'article',
        feedback:
          'Порядок слов верный, но egg начинается с гласного звука /e/. Перед ним нужна форма an: an egg. Яйцо пока остаётся на столе. Замени только артикль; можно отменить ходы или начать комнату заново.',
      },
    ],
  },
  choiceKey: {
    id: 'chapter-01-05-key',
    revision: 1,
    columns: 7,
    rows: 4,
    walls: [{ x: 6, y: 0 }],
    slots: [
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
    start: { x: 4, y: 3 },
    pieces: [
      { id: 'a', kind: 'word', word: 'a', x: 5, y: 1 },
      { id: 'an', kind: 'word', word: 'an', x: 1, y: 1 },
      { id: 'key', kind: 'word', word: 'key', x: 4, y: 2 },
    ],
    answers: [{ words: ['a', 'key'], goal: true }],
    mistakes: [
      {
        words: ['an', 'key'],
        reason: 'article',
        feedback:
          'key начинается с согласного звука /k/. Перед ним используем a: a key. Смысл — один любой подходящий ключ. Ключ остаётся на столе; замени артикль. Можно отменить ходы или начать комнату заново.',
      },
    ],
  },
  choiceApple: {
    id: 'chapter-01-05-apple',
    revision: 1,
    columns: 7,
    rows: 4,
    walls: [{ x: 0, y: 0 }],
    slots: [
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    start: { x: 3, y: 3 },
    pieces: [
      { id: 'a', kind: 'word', word: 'a', x: 5, y: 1 },
      { id: 'an', kind: 'word', word: 'an', x: 1, y: 1 },
      { id: 'apple', kind: 'word', word: 'apple', x: 3, y: 2 },
    ],
    answers: [{ words: ['an', 'apple'], goal: true }],
    mistakes: [
      {
        words: ['a', 'apple'],
        reason: 'article',
        feedback:
          'apple начинается с гласного звука /æ/. Перед ним используем an: an apple. В прошлой просьбе было a key, но форма выбирается заново по следующему звуку. Яблоко остаётся на столе; можно отменить ходы или начать комнату заново.',
      },
    ],
  },
};

export function validateLevel(level: LevelDefinition): string[] {
  const errors: string[] = [];
  const positionKey = (p: Position) => `${p.x},${p.y}`;
  const inside = (p: Position) =>
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < level.columns &&
    p.y < level.rows;
  if (!level.id || !Number.isInteger(level.revision) || level.revision < 1)
    errors.push('Invalid identity/version');
  if (![level.columns, level.rows].every((n) => Number.isInteger(n) && n > 0))
    errors.push('Invalid board dimensions');
  const walls = new Set(level.walls.map(positionKey));
  if (walls.size !== level.walls.length || level.walls.some((p) => !inside(p)))
    errors.push('Invalid walls');
  if (!inside(level.start) || walls.has(positionKey(level.start)))
    errors.push('Invalid start');
  if (
    !level.slots.length ||
    new Set(level.slots.map(positionKey)).size !== level.slots.length ||
    level.slots.some((p) => !inside(p) || walls.has(positionKey(p)))
  )
    errors.push('Invalid reading slots');
  if (
    new Set(level.pieces.map((p) => p.id)).size !== level.pieces.length ||
    level.pieces.some((p) => !p.id)
  )
    errors.push('Duplicate/empty piece ID');
  if (
    new Set(level.pieces.map(positionKey)).size !== level.pieces.length ||
    level.pieces.some(
      (p) =>
        !inside(p) ||
        walls.has(positionKey(p)) ||
        positionKey(p) === positionKey(level.start),
    )
  )
    errors.push('Invalid piece positions');
  if (
    level.pieces.some(
      (p) => p.kind === 'word' && (!p.word.trim() || p.word !== p.word.trim()),
    )
  )
    errors.push('Invalid word text');
  const patterns = [...level.answers, ...level.mistakes];
  const presentation = level.presentation;
  if (
    presentation?.speakers &&
    (presentation.speakers.task.length !== presentation.introduction.length ||
      presentation.speakers.success.length !== presentation.success.length)
  )
    errors.push('Every dialogue line needs a speaker');
  if (level.optionalLeadingArticle && level.slots.length !== 2)
    errors.push('Optional article requires two reading slots');
  if (
    patterns.some(
      (a) =>
        (a.words.length !== level.slots.length &&
          !(level.optionalLeadingArticle && a.words.length === 1) &&
          !(
            level.message?.exchange &&
            a.words.length >= 2 &&
            a.words.length <= level.slots.length
          )) ||
        a.words.some((w) => !w.trim()),
    )
  )
    errors.push('Invalid answer length/text');
  if (
    new Set(patterns.map((a) => JSON.stringify(a.words))).size !==
    patterns.length
  )
    errors.push('Conflicting answer patterns');
  const goals = level.answers.filter((a) => a.goal);
  const reference = level.reference;
  if (level.message?.intent === 'exchange') {
    const context = level.message.exchange;
    if (
      !context ||
      !context.focus.length ||
      !context.addressees.includes(level.message.recipient) ||
      !context.selfGroup.includes(level.message.speaker) ||
      context.thirdGroup.includes(level.message.speaker) ||
      typeof context.ready !== 'boolean' ||
      !context.evidence.trim() ||
      !context.focusLabel.trim() ||
      (context.act === 'short-answer' && !context.question)
    )
      errors.push('Invalid exchange roles or facts');
    const inquiry = context?.inquiry;
    if (
      inquiry &&
      (!inquiry.before.trim() ||
        !inquiry.reply.trim() ||
        !inquiry.mismatch.trim() ||
        !inquiry.accepted.length ||
        inquiry.accepted.some(
          (words) =>
            !level.answers.some(
              (answer) =>
                answer.words.length === words.length &&
                answer.words.every((word, i) => word === words[i]),
            ),
        ))
    )
      errors.push('Invalid authored inquiry');
  }
  if (
    level.allowContractions &&
    (!level.message || level.slots.length < 3 || level.optionalLeadingArticle)
  )
    errors.push('Contractions require an authored sentence frame');
  if (
    level.message?.intent === 'label-group' &&
    (!reference?.indicatedId ||
      level.slots.length !== 2 ||
      level.message.subject ||
      reference.objects.some(
        (object) => object.display === 'record' && !object.caption?.trim(),
      ))
  )
    errors.push('Group label requires a pointed quantity record');
  if (
    level.message?.intent === 'describe-object' &&
    (!reference?.indicatedId ||
      level.message.subject ||
      reference.objects.some(
        (object) => !['umbrella', 'egg'].includes(object.noun),
      ))
  )
    errors.push(
      'Object description requires a pointed supported object, not a participant',
    );
  if (
    reference &&
    (!reference.markerLabel.trim() ||
      new Set(reference.objects.map((o) => o.id)).size !==
        reference.objects.length ||
      reference.objects.some(
        (o) => !o.id || !o.noun.trim() || !o.label.trim(),
      ) ||
      (reference.indicatedId !== null &&
        !reference.objects.some((o) => o.id === reference.indicatedId)))
  )
    errors.push('Invalid reference context');
  if (
    level.answers.some(
      (answer) =>
        answer.referentId !== undefined &&
        (!answer.goal ||
          !reference?.objects.some(
            (o) => o.id === answer.referentId && answer.words.includes(o.noun),
          )),
    )
  )
    errors.push('Invalid answer referent');
  if (!goals.length) errors.push('No goal answer');
  if (
    level.answers.some(
      (a) =>
        a.effect &&
        (!a.goal ||
          (a.effect.type === 'record-message'
            ? !level.message
            : !reference ||
              !reference.objects.some((o) => a.words.includes(o.noun)))),
    )
  )
    errors.push('Invalid answer effect');
  if (level.continuation)
    errors.push(
      ...validateLevel(level.continuation).map((e) => `Continuation: ${e}`),
    );
  for (const goal of goals) {
    const available = level.pieces.flatMap((p) =>
      p.kind === 'word' ? [p.word] : [],
    );
    for (const word of goal.words) {
      const i = available.indexOf(word);
      if (i < 0) {
        errors.push('Goal words unavailable');
        break;
      }
      available.splice(i, 1);
    }
  }
  return errors;
}

for (const definition of Object.values(levels)) {
  const errors = validateLevel(definition);
  if (errors.length) throw new Error(`${definition.id}: ${errors.join('; ')}`);
}
