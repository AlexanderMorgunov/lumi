import { episodes, type EpisodeId, type MeaningChoice } from './episodes';
import { expandContraction, isContraction } from './contractions';
import {
  expandExchange,
  exchangeForm,
  exchangeMeaning,
  exchangeReply,
  exchangeText,
} from './station-exchange';
import type { RecordedMessage } from './station-chapter';
import {
  levels,
  validateLevel,
  type LevelDefinition,
  type Position,
  type Piece,
  type ReferenceObject,
} from './levels';
export type { Position, Piece } from './levels';
// Authored requests, deliberately not a general English parser.
export type Direction = 'up' | 'down' | 'left' | 'right';
export const offsets: Record<Direction, Position> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
export type Room = Position & {
  episode: EpisodeId;
  definition: LevelDefinition;
  rootDefinition: LevelDefinition;
  stage: number;
  facing: Direction;
  pieces: Piece[];
  moves: number;
  completed: boolean;
  deliveredItem: boolean;
  messages: readonly RecordedMessage[];
  inventory: readonly (ReferenceObject & { location: 'bag' | 'door' })[];
  reference: {
    objects: readonly (ReferenceObject & {
      location: 'table' | 'selected' | 'bag' | 'door';
    })[];
    indicatedId: string | null;
    knownIds: readonly string[];
  } | null;
};
export type Evaluation = {
  form: 'valid' | 'incomplete' | 'order' | 'article' | 'mismatch' | 'agreement';
  explanation?: string;
  inReadingFrame: boolean;
  goal: boolean;
  referentId?: string;
};
export type Attempt = Evaluation & { words: string[]; levelId: string };
export type Feedback =
  | 'start'
  | 'move'
  | 'push'
  | 'blocked'
  | 'undo'
  | 'reset'
  | 'incomplete'
  | 'order'
  | 'article'
  | 'agreement'
  | 'mismatch'
  | 'context'
  | 'outside'
  | 'success'
  | 'hint';
export type PuzzleState = Room & {
  explanations: MeaningChoice[];
  history: Room[];
  attempts: Attempt[];
  hintUsed: boolean;
  feedback: Feedback;
  revision: number;
};
export type PuzzleAction =
  | { type: 'move'; direction: Direction }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'apply' }
  | { type: 'hint' };
export type StageAction = { type: 'continue' };

export function createPuzzle(
  episode: EpisodeId = 'cat',
  definition: LevelDefinition = levels[episode],
): PuzzleState {
  const errors = validateLevel(definition);
  if (errors.length) throw new Error(`${definition.id}: ${errors.join('; ')}`);
  return {
    episode,
    definition,
    rootDefinition: definition,
    stage: 0,
    explanations: [],
    ...definition.start,
    facing: 'up',
    moves: 0,
    completed: false,
    deliveredItem: false,
    messages: [],
    inventory: [],
    reference: definition.reference
      ? {
          objects: definition.reference.objects.map((object) => ({
            ...object,
            location: 'table',
          })),
          indicatedId: definition.reference.indicatedId,
          knownIds: definition.reference.indicatedId
            ? [definition.reference.indicatedId]
            : [],
        }
      : null,
    pieces: definition.pieces.map((piece) => ({ ...piece })),
    history: [],
    attempts: [],
    hintUsed: false,
    feedback: 'start',
    revision: 0,
  };
}
export const samePosition = (a: Position, b: Position) =>
  a.x === b.x && a.y === b.y;
const add = (a: Position, b: Position): Position => ({
  x: a.x + b.x,
  y: a.y + b.y,
});
export function isWall(p: Position, level: LevelDefinition) {
  return (
    p.x < 0 ||
    p.y < 0 ||
    p.x >= level.columns ||
    p.y >= level.rows ||
    level.walls.some((w) => samePosition(w, p))
  );
}
export function readPhrase(state: Room): string[] {
  const words = state.definition.slots.map((slot) => {
    const piece = state.pieces.find((p) => samePosition(p, slot));
    return piece?.kind === 'word' ? piece.word : '';
  });
  if (state.definition.message?.exchange) {
    let start = 0;
    let end = words.length;
    while (
      start < end &&
      words[start] === '' &&
      !state.pieces.some((p) => samePosition(p, state.definition.slots[start]!))
    )
      start++;
    while (
      end > 0 &&
      words[end - 1] === '' &&
      !state.pieces.some((p) =>
        samePosition(p, state.definition.slots[end - 1]!),
      )
    )
      end--;
    return words.slice(start, end);
  }
  if (state.definition.allowContractions) {
    // An empty edge is layout, not grammar. Never erase a gap or an object.
    const empty = (index: number) =>
      words[index] === '' &&
      !state.pieces.some((piece) =>
        samePosition(piece, state.definition.slots[index]!),
      );
    let start = 0;
    let end = words.length;
    while (start < end && empty(start)) start++;
    while (end > start && empty(end - 1)) end--;
    if (isContraction(words[start] ?? '')) return words.slice(start, end);
  }
  return state.definition.optionalLeadingArticle &&
    words[0] === '' &&
    !state.pieces.some((piece) =>
      samePosition(piece, state.definition.slots[0]!),
    )
    ? words.slice(1)
    : words;
}
const matches = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((word, i) => word === b[i]);
export function evaluateWords(
  definition: LevelDefinition,
  words: string[],
): Evaluation {
  if (definition.message?.exchange) return exchangeForm(definition, words);
  const base = { inReadingFrame: true, goal: false };
  if (
    definition.allowContractions &&
    isContraction(words[0] ?? '') &&
    words.length === definition.slots.length &&
    words.every(Boolean)
  )
    return {
      ...base,
      form: 'mismatch',
      explanation:
        'В сокращении уже есть местоимение и форма be: например, I’m = I am. Не добавляй am/is/are второй раз. Короткая запись занимает на одну клетку меньше; пустую клетку можно оставить с любого края.',
    };
  if (definition.allowContractions) words = expandContraction(words);
  const compact = words.filter(Boolean);
  if (
    definition.message?.intent === 'describe-object' &&
    words.length === definition.slots.length &&
    compact.length === 3 &&
    ['It', 'He', 'She'].includes(compact[0]!) &&
    compact[1] === 'is' &&
    ['umbrella', 'egg'].includes(compact[2]!)
  )
    return {
      ...base,
      form: 'article',
      explanation:
        'В описании одного предмета нужен артикль. Umbrella и egg начинаются с гласных звуков: поставь an перед названием предмета.',
    };
  if (
    (definition.message?.intent === 'describe-self' ||
      definition.message?.intent === 'describe-recipient' ||
      definition.message?.intent === 'describe-third-party') &&
    words.length === definition.slots.length &&
    compact.length === 3 &&
    ((compact[0] === 'I' && compact[1] === 'am') ||
      (compact[0] === 'You' && compact[1] === 'are') ||
      (['He', 'She'].includes(compact[0]!) && compact[1] === 'is')) &&
    (compact[2] === 'lantern' || compact[2] === 'robot')
  )
    return {
      ...base,
      form: 'article',
      explanation:
        'В таком описании одного фонаря или робота нужен артикль: a lantern или a robot. Поставь a перед названием предмета.',
    };
  if (
    (words.length !== definition.slots.length &&
      !(definition.optionalLeadingArticle && words.length === 1)) ||
    words.some((word) => !word)
  )
    return { ...base, form: 'incomplete' };
  const answer = definition.answers.find((answer) =>
    matches(answer.words, words),
  );
  if (answer)
    return {
      form: 'valid',
      inReadingFrame: true,
      goal: answer.goal,
      ...(answer.feedback ? { explanation: answer.feedback } : {}),
    };
  const mistake = definition.mistakes.find((mistake) =>
    matches(mistake.words, words),
  );
  if (mistake)
    return { ...base, form: mistake.reason, explanation: mistake.feedback };
  const reordered = definition.answers.some((answer) =>
    matches([...answer.words].sort(), [...words].sort()),
  );
  return { ...base, form: reordered ? 'order' : 'mismatch' };
}
export function evaluatePhrase(state: Room): Evaluation {
  const phrase = readPhrase(state);
  const words = state.definition.message?.exchange
    ? expandExchange(phrase)
    : state.definition.allowContractions
      ? expandContraction(phrase)
      : phrase;
  const evaluation = evaluateWords(state.definition, phrase);
  if (evaluation.form === 'article') return evaluation;
  // The filled frame takes priority over any correct phrase elsewhere.
  if (words.every(Boolean)) {
    const answer = state.definition.answers.find((answer) =>
      matches(answer.words, words),
    );
    const effect = answer?.effect;
    let referentId = answer?.referentId;
    if (evaluation.goal && effect?.type === 'record-message') {
      const context = state.definition.message;
      if (!context) return { ...evaluation, goal: false };
      if (context.exchange) return exchangeMeaning(context, words);
      const speaker = context.people[context.speaker];
      if (
        ((context.intent === 'introduce-self' ||
          context.intent === 'describe-self') &&
          words[0] !== 'I') ||
        ((context.intent === 'name-recipient' ||
          context.intent === 'describe-recipient') &&
          words[0] !== 'You')
      )
        return {
          ...evaluation,
          goal: false,
          explanation: `Форма предложения верна, но выбрана другая роль. ${speaker.label} ${context.intent.endsWith('-recipient') ? 'обращается к собеседнику: нужно you' : 'говорит о себе: нужно I'}.`,
        };
      if (context.intent === 'label-group') {
        const object = state.reference?.objects.find(
          (item) => item.id === state.reference?.indicatedId,
        );
        if (!object || object.location !== 'table')
          return {
            ...evaluation,
            goal: false,
            explanation:
              'Не выбрана запись для подписи. Начни эту часть заново или отмени ход.',
          };
        const quantity = words[0] === 'two' ? 2 : 1;
        if (
          object.noun === 'people' &&
          words[1] === 'children' &&
          quantity === 2
        )
          return {
            ...evaluation,
            goal: false,
            explanation:
              'На картинке взрослый и ребёнок. Two children означало бы двух детей. Для этой пары подходит two people — два человека.',
          };
        return words[1] === object.noun && quantity === (object.count ?? 1)
          ? { ...evaluation, referentId: object.id }
          : {
              ...evaluation,
              goal: false,
              explanation: `Подпись составлена верно, но не подходит выбранной записи: ${object.label}. Проверь и количество, и название.`,
            };
      }
      if (context.intent === 'describe-object') {
        const object = state.reference?.objects.find(
          (item) => item.id === state.reference?.indicatedId,
        );
        if (!object || object.location !== 'table')
          return {
            ...evaluation,
            goal: false,
            explanation:
              'Пока не понятно, какой предмет описываем. Верни указатель отменой или начни эпизод заново.',
          };
        if (words[0] !== 'It')
          return {
            ...evaluation,
            goal: false,
            explanation:
              'Форма предложения возможна, но здесь описываем обычный предмет, без лица и характера. Для него используем it. Род русского названия не определяет английское местоимение.',
          };
        return words[3] === object.noun
          ? { ...evaluation, referentId: object.id }
          : {
              ...evaluation,
              goal: false,
              explanation: `Предложение построено верно, но под указателем другой предмет: ${object.label}. Опиши именно его; слова ничего не превращают.`,
            };
      }
      if (
        context.intent === 'name-third-party' ||
        context.intent === 'describe-third-party'
      ) {
        if (!context.subject) return { ...evaluation, goal: false };
        const subject = context.people[context.subject];
        if (words[0] === 'You')
          return {
            ...evaluation,
            goal: false,
            explanation: `Предложение построено верно, но you обозначает собеседника (${context.people[context.recipient].label}). Сейчас сообщение о другом герое: ${subject.label}.`,
          };
        if (words[0] !== subject.pronoun)
          return {
            ...evaluation,
            goal: false,
            explanation: `Форма предложения верна, но местоимение не подходит герою, о котором говорим. Здесь речь о ${subject.name}: в нашей истории используем ${subject.pronoun.toLowerCase()}.`,
          };
        const describesSubject =
          context.intent === 'name-third-party'
            ? words[2] === subject.name
            : words[3] === subject.kind;
        return describesSubject
          ? evaluation
          : {
              ...evaluation,
              goal: false,
              explanation: `Местоимение и форма глагола подходят, но имя или описание неверны. Речь о герое ${subject.label}, а не о говорящем или собеседнике.`,
            };
      }
      if (
        context.intent === 'name-recipient' ||
        context.intent === 'describe-recipient'
      ) {
        const recipient = context.people[context.recipient];
        if (words[0] === 'I')
          return {
            ...evaluation,
            goal: false,
            explanation: `Форма предложения верна, но I обозначает говорящего. Сейчас ${speaker.label} обращается к собеседнику (${recipient.label}), а не рассказывает о себе. Для обращения нужно You are.`,
          };
        const matchesRecipient =
          context.intent === 'name-recipient'
            ? words[2] === recipient.name
            : words[3] === recipient.kind;
        return matchesRecipient
          ? evaluation
          : {
              ...evaluation,
              goal: false,
              explanation: `Предложение построено верно, но не соответствует собеседнику. Сейчас адресат — ${recipient.label}. Проверь его имя или описание.`,
            };
      }
      if (context.intent === 'describe-self') {
        return words[3] === speaker.kind
          ? evaluation
          : {
              ...evaluation,
              goal: false,
              explanation: `Предложение построено верно, но описание не подходит говорящему. Сейчас говорит ${speaker.label}: ${speaker.kind === 'lantern' ? 'живой фонарь, а не робот' : 'робот, а не фонарь'}. Сообщение пока не записано.`,
            };
      }
      return words[2] === speaker.name
        ? evaluation
        : {
            ...evaluation,
            goal: false,
            explanation: `Фраза построена верно, но сейчас говорит ${speaker.label}. Нужно назвать своё имя: ${speaker.name}. Бирка пока не подписана.`,
          };
    }
    if (evaluation.goal && effect && effect.type !== 'record-message') {
      const reference = state.reference;
      const candidate =
        effect.target === 'known'
          ? reference?.objects.find(
              (o) =>
                o.id === reference.indicatedId &&
                words.includes(o.noun) &&
                reference.knownIds.includes(o.id) &&
                (o.location === 'selected' || o.location === 'table'),
            )
          : reference?.objects.find(
              (o) => o.location === 'table' && words.includes(o.noun),
            );
      if (!candidate)
        return {
          ...evaluation,
          goal: false,
          explanation:
            'Форма верная, но предмет для этой просьбы сейчас не определён или недоступен. Проверь ситуацию в журнале; можно отменить действия или начать эпизод заново.',
        };
      referentId = candidate.id;
      return { ...evaluation, referentId };
    }
    if (!evaluation.goal || !referentId) return evaluation;
    const reference = state.reference;
    if (
      !reference ||
      reference.indicatedId !== referentId ||
      !reference.knownIds.includes(referentId) ||
      !reference.objects.some(
        (object) => object.id === referentId && object.location === 'table',
      )
    )
      return {
        ...evaluation,
        goal: false,
        explanation:
          'Сочетание построено верно, но нужный предмет сейчас не указан однозначно или уже перемещён. Проверь ситуацию в журнале; можно начать комнату заново.',
      };
    return { ...evaluation, referentId };
  }
  for (const piece of state.pieces) {
    if (piece.kind !== 'word') continue;
    for (const answer of state.definition.answers) {
      const outside = answer.words.every((word, index) =>
        state.pieces.some(
          (p) =>
            p.kind === 'word' &&
            p.word === word &&
            p.y === piece.y &&
            p.x === piece.x + index,
        ),
      );
      if (outside) return { form: 'valid', inReadingFrame: false, goal: false };
    }
  }
  return evaluation;
}
function snapshot(s: Room): Room {
  return {
    episode: s.episode,
    definition: s.definition,
    rootDefinition: s.rootDefinition,
    stage: s.stage,
    x: s.x,
    y: s.y,
    facing: s.facing,
    pieces: s.pieces,
    moves: s.moves,
    completed: s.completed,
    deliveredItem: s.deliveredItem,
    messages: s.messages,
    inventory: s.inventory,
    reference: s.reference,
  };
}
export function reducePuzzle(
  state: PuzzleState,
  action: PuzzleAction | StageAction,
): PuzzleState {
  const revision = state.revision + 1;
  if (action.type === 'reset')
    return {
      ...createPuzzle(state.episode, state.rootDefinition),
      explanations: state.explanations,
      attempts: state.attempts,
      hintUsed: state.hintUsed,
      feedback: 'reset',
      revision,
    };
  if (action.type === 'hint')
    return { ...state, hintUsed: true, feedback: 'hint', revision };
  if (action.type === 'undo') {
    const previous = state.history.at(-1);
    return previous
      ? {
          ...state,
          ...previous,
          history: state.history.slice(0, -1),
          feedback: 'undo',
          revision,
        }
      : state;
  }
  if (action.type === 'continue') {
    const next = state.definition.continuation;
    if (!state.completed || !next) return state;
    const fresh = createPuzzle(state.episode, next);
    return {
      ...fresh,
      rootDefinition: state.rootDefinition,
      stage: state.stage + 1,
      reference: next.carryReference ? state.reference : fresh.reference,
      inventory: state.inventory,
      messages: state.messages,
      history: [...state.history, snapshot(state)],
      attempts: state.attempts,
      explanations: state.explanations,
      hintUsed: state.hintUsed,
      revision,
    };
  }
  if (state.completed) return state;
  if (action.type === 'apply') {
    const evaluation = evaluatePhrase(state);
    const effect = state.definition.answers.find((answer) =>
      matches(
        answer.words,
        state.definition.message?.exchange
          ? expandExchange(readPhrase(state))
          : state.definition.allowContractions
            ? expandContraction(readPhrase(state))
            : readPhrase(state),
      ),
    )?.effect;
    const message = state.definition.message;
    const isMessage = effect?.type === 'record-message';
    const describedObject =
      isMessage &&
      (message?.intent === 'describe-object' ||
        message?.intent === 'label-group')
        ? state.reference?.objects.find(
            (object) => object.id === evaluation.referentId,
          )
        : undefined;
    const destination =
      effect && 'destination' in effect ? effect.destination : undefined;
    const delivered =
      evaluation.goal && !isMessage && effect?.type !== 'select'
        ? state.reference?.objects.find(
            (object) => object.id === evaluation.referentId,
          )
        : undefined;
    return {
      ...state,
      revision,
      attempts: [
        ...state.attempts,
        {
          ...evaluation,
          words: readPhrase(state),
          levelId: state.definition.id,
        },
      ],
      history: evaluation.goal
        ? [...state.history, snapshot(state)]
        : state.history,
      completed: evaluation.goal,
      deliveredItem: evaluation.goal && !isMessage && effect?.type !== 'select',
      messages:
        evaluation.goal && isMessage && message
          ? [
              ...state.messages,
              {
                speaker: message.speaker,
                recipient: message.recipient,
                ...(message.exchange?.inquiry
                  ? {
                      authorLabel: message.exchange.inquiry.authorLabel,
                      audienceLabel: message.exchange.audienceLabel,
                    }
                  : {}),
                ...(message.subject ? { subject: message.subject } : {}),
                ...(describedObject
                  ? {
                      object: {
                        id: describedObject.id,
                        noun: describedObject.noun,
                        label: describedObject.label,
                      },
                    }
                  : {}),
                text: message.exchange
                  ? exchangeText(readPhrase(state))
                  : readPhrase(state).join(' '),
                ...(message.exchange?.act === 'question'
                  ? { question: true, reply: exchangeReply(message.exchange) }
                  : {}),
              },
            ]
          : state.messages,
      inventory: delivered
        ? [
            ...state.inventory.filter((object) => object.id !== delivered.id),
            { ...delivered, location: destination ?? 'bag' },
          ]
        : state.inventory,
      reference:
        evaluation.goal &&
        !isMessage &&
        evaluation.referentId &&
        state.reference
          ? {
              ...state.reference,
              indicatedId: evaluation.referentId,
              knownIds: [
                ...new Set([
                  ...state.reference.knownIds,
                  evaluation.referentId,
                ]),
              ],
              objects: state.reference.objects.map((object) =>
                object.id === evaluation.referentId
                  ? {
                      ...object,
                      location:
                        effect?.type === 'select'
                          ? 'selected'
                          : (destination ?? 'bag'),
                    }
                  : object,
              ),
            }
          : state.reference,
      feedback: evaluation.goal
        ? 'success'
        : !evaluation.inReadingFrame
          ? 'outside'
          : evaluation.form === 'valid'
            ? 'context'
            : evaluation.form,
    };
  }
  const delta = offsets[action.direction];
  const destination = add(state, delta);
  const pushed = new Set<Piece['id']>();
  let cursor = destination;
  while (!isWall(cursor, state.definition)) {
    const piece = state.pieces.find((p) => samePosition(p, cursor));
    if (!piece) break;
    pushed.add(piece.id);
    cursor = add(cursor, delta);
  }
  if (isWall(cursor, state.definition))
    return {
      ...state,
      facing: action.direction,
      feedback: 'blocked',
      revision,
    };
  return {
    ...state,
    ...destination,
    facing: action.direction,
    revision,
    pieces: state.pieces.map((p) =>
      pushed.has(p.id) ? { ...p, ...add(p, delta) } : p,
    ),
    moves: state.moves + 1,
    history: [...state.history, snapshot(state)],
    feedback: pushed.size ? 'push' : 'move',
  };
}
export function feedbackText(state: PuzzleState): string {
  if (state.definition.presentation) {
    if (state.feedback === 'hint') return state.definition.presentation.hint;
    if (state.feedback === 'success')
      return state.definition.presentation.success[0] ?? 'Просьба выполнена.';
    if (state.feedback === 'start') return state.definition.presentation.quest;
  }
  switch (state.feedback) {
    case 'blocked':
      return 'Здесь не пройти. Можно обойти препятствие или отменить ход.';
    case 'outside':
      return 'Верное сочетание находится вне рамки. Перемести его в рамку чтения, чтобы передать просьбу.';
    case 'incomplete':
      if (state.definition.message?.exchange)
        return 'Поставь слова рядом, без пустых клеток между ними. Свободные клетки можно оставить с любого края рамки: у полной и сокращённой форм разная длина.';
      if (state.definition.allowContractions)
        return 'Поставь слова рядом, без пустых клеток между ними. I’m Lumi занимает две клетки, I am Lumi — три. Пустую клетку можно оставить с любого края.';
      if (state.definition.optionalLeadingArticle)
        return 'Поставь название предметов в правую клетку рамки. Слева можно поставить артикль или оставить место пустым — реши по смыслу просьбы.';
      return 'Заполни все клетки рамки словами. Сейчас сочетание ещё не собрано.';
    case 'order':
      return 'Слова в рамке стоят в неверном порядке. Проверь порядок по правилу в журнале.';
    case 'article':
    case 'agreement':
    case 'mismatch':
    case 'context':
      return (
        state.attempts.at(-1)?.explanation ??
        'Эта конструкция не соответствует просьбе. Проверь слова и правило в журнале.'
      );
    case 'success':
      if (state.episode === 'theApple')
        return 'Левое яблоко, выбранное для смотрителя, теперь в сумке Марты. Остальные два остались в мастерской.';
      if (state.episode === 'theKey')
        return 'Указанный средний ключ от двери мастерской теперь в сумке Марты. Два других ключа остались на столе.';
      if (state.episode === 'choiceKey')
        return 'Один из трёх запасных ключей переложен в сумку помощника Марты.';
      if (state.episode === 'choiceApple')
        return 'Одно из трёх яблок добавлено в сумку помощника. Обе просьбы перед дорогой выполнены.';
      if (state.episode === 'egg')
        return 'Одно из трёх варёных яиц переложено в сумку Марты для привала.';
      if (state.episode === 'apple')
        return 'Одно из трёх яблок переложено со стола в дорожную сумку для Марты.';
      return state.episode === 'cat'
        ? 'Марта: «Спасибо! Карточка с котом отправится с нами в дорогу».'
        : 'Один из запасных ключей переложен со стола в дорожную сумку.';
    case 'undo':
      return 'Ход отменён. Можно попробовать другой путь.';
    case 'reset':
      return 'Комната возвращена в начало. Объяснение доступно в журнале.';
    case 'hint':
      if (state.episode === 'theApple')
        return 'Кот указал на левое яблоко: нужен определённый артикль, the apple. Из начального положения: ↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑. При толкании the табличка an тоже сдвинется — это нормально. Если слова застряли, начни комнату заново через меню.';
      if (state.episode === 'theKey')
        return 'Кот указал на средний ключ: вам обоим понятно, какой нужен. Собери the key. Из начального положения: ↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑. Если слова застряли, начни комнату заново через меню.';
      if (state.episode === 'choiceKey')
        return 'key начинается с согласного /k/: a key. Слева в рамке поставь a, справа — key. Из начального положения: ↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑. Если блоки застряли, начни комнату заново через меню.';
      if (state.episode === 'choiceApple')
        return 'apple начинается с гласного /æ/: an apple. Слева в рамке поставь an, справа — apple. Из начального положения: ↑ ↑ ↓ ← ← ← ↑ → ↓ → ↑. Если блоки застряли, начни комнату заново через меню.';
      if (state.episode === 'egg')
        return 'Нужно одно любое яйцо; egg начинается с гласного /e/: an egg. Слева в рамке поставь an, справа — egg. Из начального положения подойдёт маршрут ↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑. Если слова застряли, начни комнату заново через меню. Подсказка не отнимает попытки.';
      if (state.episode === 'apple')
        return 'apple начинается с гласного звука /æ/: an apple. Из начального положения толкни apple вверх (↑), справа от an. Если блоки застряли, начни комнату заново через меню. Подсказка не отнимает попытки.';
      if (state.episode === 'key')
        return 'Нужен один любой ключ: a key. Помести a в левую клетку рамки, key — в правую. Если застрял, начни комнату заново. Маршрут из начального положения: ← ↑ ↓ → → → ↑ ← ↓ ← ↑. Подсказка не отнимает попытки.';
      return 'Встань под cat и толкни его вверх, справа от a. Если блоки застряли, открой меню и выбери «Начать комнату заново»: после этого достаточно одного шага ↑.';
    case 'push':
      return 'Блок сдвинут на клетку. В рамке слова читаются слева направо.';
    case 'move':
      return 'Подойди к слову и шагни в его сторону, чтобы толкнуть.';
    default:
      return state.episode === 'cat'
        ? 'Первый шаг: нажми ↑, чтобы подтолкнуть cat в рамку рядом с a.'
        : episodes[state.episode].quest;
  }
}
