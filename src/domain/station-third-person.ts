import type { LevelDefinition, Piece } from './levels';
import { stationPeople } from './station-chapter';

export const stationThirdEpisode = 'chapter-02-04' as const;
export const stationThirdRule =
  'He — личное местоимение «он», she — «она». Они могут заменять имя того, о ком говорим. О женщине обычно говорим she, о мужчине — he. В нашей истории о Марте говорим she, о Тике — he: Тик — одушевлённый персонаж, а не правило для любого робота. С he и she нужна форма is глагола be: She is Marta — «Она Марта»; He is a robot — «Он робот». Is связывает того, о ком говорим, с именем или описанием; в этой конструкции его не пропускаем. Перед именем Marta артикля нет; перед robot нужен a, потому что называем одного робота и первый звук согласный. I — говорящий, you — его собеседник, he/she — тот, о ком они говорят. Если Марта и Люми по очереди рассказывают о Тике, he по-прежнему обозначает Тика. Должно быть понятно, о ком речь; в наших заданиях это указано до хода. Обычные предметы и другие случаи употребления местоимений разберём дальше. В начале предложения пишем He/She, внутри обычно he/she.';
const tile = (word: string, x: number, y: number): Piece => ({
  id: word,
  kind: 'word',
  word,
  x,
  y,
});
const pairs = [
  ['She', 'is'],
  ['He', 'is'],
  ['You', 'are'],
] as const;
const answers = (endings: string[][]): LevelDefinition['answers'] =>
  pairs.flatMap(([pronoun, verb]) =>
    endings.map((ending) => ({
      words: [pronoun, verb, ...ending],
      goal: true,
      effect: { type: 'record-message' },
    })),
  );
const mistakes = (endings: string[][]): LevelDefinition['mistakes'] =>
  [
    ['She', 'am'],
    ['She', 'are'],
    ['He', 'am'],
    ['He', 'are'],
    ['You', 'am'],
    ['You', 'is'],
  ].flatMap(([pronoun, verb]) =>
    endings.map((ending) => ({
      words: [pronoun!, verb!, ...ending],
      reason: 'agreement',
      feedback:
        pronoun === 'You'
          ? 'С you нужна форма are. Затем проверь смысл: сейчас говорим о другом герое, а не обращаемся к нему.'
          : 'С he и she нужна форма is. Am используем с I, а are — с you. Сначала исправь форму глагола, затем проверь, о ком сообщение.',
    })),
  );
const board = { revision: 1, columns: 8, rows: 5, walls: [] };
const description = {
  ...board,
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  answers: answers([
    ['a', 'robot'],
    ['a', 'lantern'],
  ]),
  mistakes: [
    ...mistakes(
      ['a', 'an'].flatMap((article) =>
        ['robot', 'lantern'].map((noun) => [article, noun]),
      ),
    ),
    ...pairs.flatMap(([pronoun, verb]) =>
      ['robot', 'lantern'].map((noun) => ({
        words: [pronoun, verb, 'an', noun],
        reason: 'article' as const,
        feedback: `${noun} начинается с согласного звука: перед этим словом нужна форма a, не an.`,
      })),
    ),
  ],
};
const transfer: LevelDefinition = {
  ...description,
  id: 'chapter-02-04-transfer',
  message: {
    speaker: 'lumi',
    recipient: 'marta',
    subject: 'tik',
    intent: 'describe-third-party',
    people: stationPeople,
  },
  start: { x: 5, y: 4 },
  pieces: [
    tile('He', 2, 2),
    tile('is', 3, 2),
    tile('a', 4, 2),
    tile('robot', 5, 3),
    tile('lantern', 6, 2),
    tile('She', 0, 2),
    tile('You', 1, 2),
    tile('are', 1, 3),
    tile('an', 6, 3),
    tile('am', 0, 3),
  ],
  presentation: {
    title: 'Говорит Люми, речь всё ещё о Тике',
    noun: 'robot',
    quest:
      'Теперь Люми сообщает Марте о Тике: «Он робот». Автор и собеседник поменялись; герой, о котором говорят, тот же.',
    introduction: [
      'Люми, теперь расскажи Марте обо мне: «Он робот». Ты говоришь, Марта слушает, а речь всё ещё о Тике. Собери сообщение без готового примера.',
    ],
    success: [
      'He is a robot. Автор сообщения сменился, но речь по-прежнему обо мне. Поэтому местоимение осталось тем же.',
      'Сначала обо мне говорила Марта, затем Люми. Почему в обоих сообщениях осталось he?',
    ],
    speakers: { task: ['tik'], success: ['tik', 'tik'] },
    rule: stationThirdRule,
    hint: 'Люми говорит Марте о Тике: He is a robot. Из начала этой части: ↑ ↑ ↓ ← ↑ ↓ ← ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
const aboutTik: LevelDefinition = {
  ...description,
  id: 'chapter-02-04-tik',
  continuation: transfer,
  message: {
    speaker: 'marta',
    recipient: 'lumi',
    subject: 'tik',
    intent: 'describe-third-party',
    people: stationPeople,
  },
  start: { x: 5, y: 3 },
  pieces: [
    tile('He', 2, 2),
    tile('is', 3, 2),
    tile('a', 4, 3),
    tile('robot', 5, 2),
    tile('lantern', 6, 3),
    tile('She', 0, 2),
    tile('You', 1, 2),
    tile('are', 1, 3),
    tile('an', 6, 2),
    tile('am', 0, 3),
  ],
  presentation: {
    title: 'Марта рассказывает о Тике',
    noun: 'robot',
    quest:
      'Марта сообщает Люми о стоящем рядом Тике: «Он робот». Составь её сообщение.',
    introduction: [
      'Люми, теперь я расскажу тебе о Тике. О нём в нашей истории говорим he — «он». Это живой герой со своим характером; не каждый робот в английском обязательно he.',
      'Составь моё сообщение: «Он робот». Я говорю с тобой, но описываю Тика. Выбери местоимение, форму глагола и артикль.',
    ],
    success: [
      'He is a robot. Он робот. Верно: я говорю тебе о Тике. Слово he обозначает его, а не меня и не тебя.',
      'Теперь поменяемся ролями: ты расскажешь мне о том же Тике. Посмотрим, изменится ли местоимение.',
    ],
    speakers: { task: ['marta', 'marta'], success: ['marta', 'marta'] },
    rule: stationThirdRule,
    hint: 'Марта говорит Люми о Тике: He is a robot. Из начала этой части: ↑ ↓ ↓ ← ↑ ↑ ↓ ← ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationThirdLevel: LevelDefinition = {
  ...board,
  id: stationThirdEpisode,
  continuation: aboutTik,
  message: {
    speaker: 'tik',
    recipient: 'lumi',
    subject: 'marta',
    intent: 'name-third-party',
    people: stationPeople,
  },
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
  ],
  start: { x: 4, y: 3 },
  pieces: [
    tile('She', 2, 1),
    tile('is', 3, 2),
    tile('Marta', 4, 2),
    tile('He', 0, 2),
    tile('You', 1, 2),
    tile('are', 1, 3),
    tile('am', 0, 3),
    tile('Lumi', 6, 3),
  ],
  answers: answers([['Marta'], ['Lumi']]),
  mistakes: mistakes([['Marta'], ['Lumi']]),
  presentation: {
    title: 'О ком мы говорим',
    noun: 'She',
    quest:
      'Тик говорит Люми о Марте у стойки: «Она Марта». Дополни сообщение о ней.',
    introduction: [
      'Люми, осталось сверить записи о спутниках. Я говорю с тобой, а расскажу о Марте. Она стоит рядом со стойкой.',
      'She — личное местоимение «она». Им можно заменить имя Марты, когда нам обоим понятно, о ком речь. О мужчине обычно говорим he — «он».',
      'С этими местоимениями нужна форма is. Это форма глагола be. Сравни: ты обращаешься к собеседнику, а сейчас я рассказываю тебе о другом герое.',
      'She is Marta — «Она Марта». Здесь я говорю, ты слушаешь, а слово she обозначает Марту. Перед её именем артикль не нужен.',
      'Соберём She is Marta. Местоимение уже в рамке: добавь форму глагола и имя героини, о которой мы говорим.',
    ],
    success: [
      'She is Marta. Верно: сообщение о Марте записано. Она не стала собеседником только потому, что мы назвали её имя.',
      'Теперь Марта расскажет тебе о другом спутнике. Послушай, о ком будет речь.',
    ],
    speakers: {
      task: ['tik', 'tik', 'tik', 'tik', 'tik'],
      success: ['tik', 'tik'],
    },
    rule: stationThirdRule,
    hint: 'Тик говорит Люми о Марте: She is Marta. Из начала эпизода: ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationThirdReflection = {
  correct: 'third-subject' as const,
  choices: [
    {
      id: 'third-subject' as const,
      label: 'Оба говорили о Тике, хотя говорящие менялись',
      feedback:
        'Верно. Марта и Люми по очереди говорили о Тике. Поэтому he в обоих сообщениях обозначает Тика. Форма глагола тоже осталась прежней.',
    },
    {
      id: 'third-speaker' as const,
      label: 'He всегда обозначает того, кто говорит',
      feedback:
        'Того, кто говорит о себе, обозначает I. Здесь авторы менялись, а he указывало на Тика — героя, о котором они рассказывали.',
    },
    {
      id: 'third-listener' as const,
      label: 'He означает собеседника, как you',
      feedback:
        'You обозначает того, к кому обращаются. В последних двух сообщениях собеседники были разными, но речь шла о Тике. Здесь he обозначает именно его.',
    },
  ],
};
