import type { LevelDefinition, Piece } from './levels';
import { stationPeople } from './station-chapter';

export const stationAddressEpisode = 'chapter-02-03' as const;
export const stationAddressRule =
  'You — личное местоимение «ты» или «вы»: тот или те, к кому обращаются. В этом эпизоде собеседник один. I обозначает говорящего, you — его адресата. С you используем are — форму глагола be: You are Lumi — «Ты Люми». Are нужно и при обращении к одному человеку или герою; оно не означает, что собеседников несколько. В русском «есть» обычно пропускаем, но в этой английской конструкции are нужно. Перед именем артикль не ставим. You are a robot — «Ты робот»: перед названием одного предмета остаётся a, потому что robot начинается с согласного звука. I am a robot — правильное предложение о себе, но оно не заменяет обращение к собеседнику. Когда меняется адресат, меняется тот, кого обозначает you. You пишется с большой буквы в начале предложения, в остальных случаях обычно с маленькой. Сокращение you’re разберём позже.';

const tile = (word: string, x: number, y: number): Piece => ({
  id: word,
  kind: 'word',
  word,
  x,
  y,
});
const names = ['Lumi', 'Marta'];
const nouns = ['robot', 'lantern'];
const pairs = [
  ['You', 'are'],
  ['I', 'am'],
] as const;
const agreement = (endings: string[][]): LevelDefinition['mistakes'] =>
  [
    ['You', 'am'],
    ['You', 'is'],
    ['I', 'are'],
    ['I', 'is'],
  ].flatMap(([pronoun, verb]) =>
    endings.map((ending) => ({
      words: [pronoun!, verb!, ...ending],
      reason: 'agreement',
      feedback:
        pronoun === 'You'
          ? 'С you нужна форма are, даже если собеседник один. Am используем с I, а is — с другими местоимениями, которые разберём позже.'
          : 'С I нужна форма am. Сначала проверь форму глагола, затем подумай: задание просит говорить о себе или обращаться к собеседнику?',
    })),
  );
const board = { revision: 1, columns: 8, rows: 5, walls: [] };
const toTik: LevelDefinition = {
  ...board,
  id: 'chapter-02-03-tik',
  message: {
    speaker: 'lumi',
    recipient: 'tik',
    intent: 'describe-recipient',
    people: stationPeople,
  },
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  start: { x: 5, y: 3 },
  pieces: [
    tile('You', 2, 2),
    tile('are', 3, 2),
    tile('a', 4, 3),
    tile('robot', 5, 2),
    tile('lantern', 6, 3),
    tile('an', 1, 2),
    tile('the', 1, 3),
    tile('is', 6, 2),
    tile('I', 0, 2),
    tile('am', 0, 3),
  ],
  answers: pairs.flatMap(([pronoun, verb]) =>
    nouns.flatMap((noun) => [
      {
        words: [pronoun, verb, 'a', noun],
        goal: true,
        effect: { type: 'record-message' },
      },
      {
        words: [pronoun, verb, 'the', noun],
        goal: false,
        feedback:
          'С the можно уточнить, какой именно это робот или фонарь. Сейчас нужно назвать вид собеседника, а не выделять его среди других. В таком описании используем a.',
      },
    ]),
  ),
  mistakes: [
    ...agreement(
      nouns.flatMap((noun) =>
        ['a', 'an', 'the'].map((article) => [article, noun]),
      ),
    ),
    ...pairs.flatMap(([pronoun, verb]) =>
      nouns.map((noun) => ({
        words: [pronoun, verb, 'an', noun],
        reason: 'article' as const,
        feedback: `${noun} начинается с согласного звука: нужна форма a, не an.`,
      })),
    ),
  ],
  presentation: {
    title: 'Теперь Люми обращается к Тику',
    noun: 'robot',
    quest:
      'Люми говорит Тику: «Ты робот». Собери обращение к Тику, а не рассказ Люми о себе.',
    introduction: [
      'Люми, теперь твоя очередь. Скажи мне: «Ты робот». Слово robot ты уже знаешь. На этот раз ты говоришь, а я слушаю.',
      'Выбери местоимение и форму глагола для обращения ко мне. Не забудь артикль перед названием одного робота. Я подожду у стойки.',
    ],
    success: [
      'You are a robot. Ты робот. Всё верно, Люми, ты обратился ко мне. Я один, но после you всё равно нужна форма are.',
      'Сначала Марта обращалась к Люми, потом Люми — ко мне. Кого обозначало you во втором сообщении?',
    ],
    speakers: { task: ['tik', 'tik'], success: ['tik', 'tik'] },
    rule: stationAddressRule,
    hint: 'Люми обращается к Тику: You are a robot. Из начала этой части: ↑ ↓ ↓ ← ↑ ↑ ↓ ← ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationAddressLevel: LevelDefinition = {
  ...board,
  id: stationAddressEpisode,
  continuation: toTik,
  message: {
    speaker: 'marta',
    recipient: 'lumi',
    intent: 'name-recipient',
    people: stationPeople,
  },
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ],
  start: { x: 4, y: 3 },
  pieces: [
    tile('You', 2, 1),
    tile('are', 3, 2),
    tile('Lumi', 4, 2),
    tile('I', 1, 2),
    tile('am', 1, 3),
    tile('Marta', 6, 2),
    tile('is', 6, 3),
  ],
  answers: pairs.flatMap(([pronoun, verb]) =>
    names.map((name) => ({
      words: [pronoun, verb, name],
      goal: true,
      effect: { type: 'record-message' },
    })),
  ),
  mistakes: agreement(names.map((name) => [name])),
  presentation: {
    title: 'Теперь я обращаюсь к тебе',
    noun: 'You',
    quest:
      'Марта обращается к Люми: «Ты Люми». Дополни её сообщение именем собеседника и нужной формой be.',
    introduction: [
      'Бирки готовы. Перед отправлением проверим, кому передаём сообщение. Люми, посмотри на меня: сейчас я обращаюсь к тебе.',
      'You — личное местоимение. Оно значит «ты» или «вы» и обозначает того, к кому обращаются. Здесь я говорю с тобой одним.',
      'С этим местоимением нужна форма are. Это форма глагола be. Даже когда собеседник один, говорим you are.',
      'Сравни: I am Marta — «Я Марта». А тебе я говорю: You are Lumi — «Ты Люми». В первой фразе речь обо мне, во второй — о тебе.',
      'Соберём моё обращение вместе: You are Lumi. Местоимение уже в рамке. Добавь форму глагола и своё имя. Перед именем артикль не нужен.',
    ],
    success: [
      'You are Lumi. Верно, ты Люми. Я говорила, ты слушал — поэтому в моём сообщении you обозначает тебя.',
      'А теперь обратись к Тику. Ты станешь автором сообщения, а он — твоим собеседником.',
    ],
    speakers: {
      task: ['marta', 'marta', 'marta', 'marta', 'marta'],
      success: ['marta', 'marta'],
    },
    rule: stationAddressRule,
    hint: 'Марта обращается к Люми: You are Lumi. Из начала эпизода: ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationAddressReflection = {
  correct: 'address-tik' as const,
  choices: [
    {
      id: 'address-tik' as const,
      label: 'Тика: Люми обращался к нему',
      feedback:
        'Верно. Во втором сообщении Люми говорил, а Тик слушал. Поэтому you обозначало Тика. С одним собеседником тоже используем are.',
    },
    {
      id: 'address-lumi' as const,
      label: 'Люми: он двигал слова и говорил',
      feedback:
        'Люми двигал слова и был автором сообщения, но обращался к Тику. Говорящего обозначает I, а его собеседника — you.',
    },
    {
      id: 'address-group' as const,
      label: 'Обоих: are означает несколько героев',
      feedback:
        'Форма are не означает, что собеседников несколько. С местоимением you она нужна и при обращении к одному. Здесь Люми говорил только с Тиком.',
    },
  ],
};
