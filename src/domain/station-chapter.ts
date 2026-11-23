import type { LevelDefinition, Piece, ReferenceObject } from './levels';
import type { ExchangeContext } from './station-exchange';

export const stationEpisode = 'chapter-02-01' as const;
export type ParticipantId = 'lumi' | 'marta' | 'tik';
export type MessageContext = {
  speaker: ParticipantId;
  recipient: ParticipantId;
  subject?: ParticipantId;
  exchange?: ExchangeContext;
  intent:
    | 'introduce-self'
    | 'describe-self'
    | 'name-recipient'
    | 'describe-recipient'
    | 'name-third-party'
    | 'describe-third-party'
    | 'describe-object'
    | 'label-group'
    | 'exchange';
  people: Readonly<
    Record<
      ParticipantId,
      {
        name: string;
        label: string;
        kind: 'lantern' | 'robot' | null;
        pronoun: 'He' | 'She';
      }
    >
  >;
};
export type RecordedMessage = {
  speaker: ParticipantId;
  recipient: ParticipantId;
  authorLabel?: string;
  audienceLabel?: string;
  subject?: ParticipantId;
  object?: Pick<ReferenceObject, 'id' | 'noun' | 'label'>;
  text: string;
  question?: boolean;
  reply?: string;
};
export const stationPeople = {
  lumi: { name: 'Lumi', label: 'Люми', kind: 'lantern', pronoun: 'He' },
  marta: { name: 'Marta', label: 'Марта', kind: null, pronoun: 'She' },
  tik: { name: 'Tik', label: 'Тик', kind: 'robot', pronoun: 'He' },
} as const;
const people = stationPeople;
export const stationRule =
  'I — личное местоимение «я»: тот, кто говорит. Его всегда пишут с большой буквы. Be — глагол «быть»; to be — название его начальной формы. Глагол может обозначать и состояние, а не только действие. В сообщении о себе используем форму am: I am Lumi — «Я Люми». В русском «есть» обычно пропускают, в этой английской конструкции am нужно. Подлежащее — тот, о ком сообщаем; здесь это I. Перед именем Lumi артикль не ставим. С другими местоимениями нужны другие формы be — их разберём дальше.';
const tile = (word: string, x: number, y: number): Piece => ({
  id: word,
  kind: 'word',
  word,
  x,
  y,
});
const answers: LevelDefinition['answers'] = ['Lumi', 'Marta'].map((name) => ({
  words: ['I', 'am', name],
  goal: true,
  effect: { type: 'record-message' },
}));
const mistakes: LevelDefinition['mistakes'] = ['Lumi', 'Marta'].map((name) => ({
  words: ['I', 'is', name],
  reason: 'agreement',
  feedback:
    'С I нужна форма am: I am. Is — другая форма be; с I она не подходит. Замени is, имя пока оставь.',
}));
const board = {
  revision: 1,
  columns: 7,
  rows: 5,
  walls: [],
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ],
  answers,
  mistakes,
};
const martaIntroduction: LevelDefinition = {
  ...board,
  id: 'chapter-02-01-marta',
  message: {
    speaker: 'marta',
    recipient: 'lumi',
    intent: 'introduce-self',
    people,
  },
  start: { x: 4, y: 4 },
  pieces: [
    tile('I', 2, 2),
    tile('am', 3, 3),
    tile('Marta', 4, 2),
    tile('Lumi', 5, 3),
    tile('is', 1, 3),
  ],
  presentation: {
    title: 'Теперь говорит Марта',
    noun: 'Marta',
    quest: 'Марта представляется Люми. Собери её сообщение: «Я Марта».',
    introduction: [
      'Я Марта, мастер фонарей. Помоги мне подписать мою бирку.',
      'Сейчас я говорю о себе, а ты слушаешь. Поэтому I в моём сообщении означает меня — Марту. Ты по-прежнему двигаешь таблички, но собираешь мои слова.',
      'Собери моё сообщение: «Я Марта». На поле два имени и две формы be. Выбери нужные и поставь их в рамку.',
    ],
    success: [
      'I am Marta. Я Марта. Спасибо, Люми! Вот теперь моя бирка подписана правильно.',
      'Обе бирки готовы — Lumi и Marta. Можно зажечь фонарь! В первом сообщении I означало Люми, во втором — Марту. Почему значение изменилось?',
    ],
    speakers: { task: ['marta', 'marta', 'marta'], success: ['marta', 'tik'] },
    rule: stationRule,
    hint: 'Говорит Марта: I am Marta. Из начального положения: ↑ ↑ ↓ ↓ ← ↑ ↑ ↓ ← ↑. Затем передай сообщение. Можно отменять ходы или начать эпизод заново.',
    destination: 'register',
  },
};
export const stationLevel: LevelDefinition = {
  ...board,
  id: stationEpisode,
  continuation: martaIntroduction,
  message: {
    speaker: 'lumi',
    recipient: 'marta',
    intent: 'introduce-self',
    people,
  },
  start: { x: 4, y: 3 },
  pieces: [
    tile('I', 2, 1),
    tile('am', 3, 1),
    tile('Lumi', 4, 2),
    tile('Marta', 5, 3),
    tile('is', 1, 3),
  ],
  presentation: {
    title: 'Имя на бирке',
    noun: 'Lumi',
    quest: 'Люми представляется Марте. Подтолкни Lumi вверх: I am Lumi.',
    introduction: [
      'Марта, Люми, заходите под навес! Ураган сорвал бирки. Давайте подпишем новые, чтобы письма находили адресатов. Начни ты, Люми, — представься Марте.',
      'I — личное местоимение. Оно значит «я» и обозначает того, кто говорит. В сообщении, которое мы собираем, Люми говорит о себе. I всегда пишется с большой буквы.',
      'Am — форма глагола be, «быть». По-русски говорим «Я Люми», а по-английски — I am Lumi. Здесь am связывает «я» с именем. Перед именем Lumi артикль не нужен.',
      'Be может описывать состояние, а не только действие. В названии темы пишут to be, но в нашем предложении нужна форма am. Подлежащее — тот, о ком сообщаем; здесь это I.',
      'В рамке уже стоят I am. Толкни Lumi вверх и передай сообщение. Сначала попробуем вместе, затем ты поможешь представиться Марте.',
    ],
    success: [
      'I am Lumi. Я Люми. Это моё имя — его и запишем на бирке!',
      'Привет, Люми! Тик уже подписал твою бирку. Теперь моя очередь: я буду говорить о себе, а ты — слушать.',
    ],
    speakers: {
      task: ['tik', 'tik', 'tik', 'tik', 'tik'],
      success: ['lumi', 'marta'],
    },
    rule: stationRule,
    hint: 'I am уже в рамке. Нажми ↑ один раз, чтобы поставить Lumi справа, затем передай сообщение.',
    destination: 'register',
  },
};
export const stationReflection = {
  correct: 'speaker-marta' as const,
  choices: [
    {
      id: 'speaker-marta' as const,
      label: 'Теперь говорит Марта — I означает её',
      feedback:
        'Верно. I указывает на автора сообщения. В I am Marta говорит Марта, хотя таблички двигает Люми. Первый эпизод станции завершён; остальные встречи ещё впереди.',
    },
    {
      id: 'speaker-lumi' as const,
      label: 'I всегда означает Люми, ведь я им управляю',
      feedback:
        'Управление героем и автор сообщения — разные вещи. Сейчас представляется Марта, поэтому I означает её.',
    },
    {
      id: 'speaker-listener' as const,
      label: 'I означает того, кто слушает',
      feedback:
        'I — «я», то есть говорящий. В этой части слушает Люми, а о себе говорит Марта.',
    },
  ],
};
