import type { LevelDefinition } from './levels';
import { createPluralPractice } from './plural-lesson';

export const closingEpisodes = {
  keyChain: {
    id: 'chapter-01-08',
    noun: 'key',
    article: 'a',
    title: 'Ключ, который мы выбрали',
    quest: 'Выбери один запасной ключ, затем попроси именно выбранный.',
    reward: 'Выбранный ключ в сумке',
  },
  appleChain: {
    id: 'chapter-01-09',
    noun: 'apple',
    article: 'an',
    title: 'Яблоко, которое мы отложили',
    quest: 'Отложи одно любое яблоко, затем попроси то же самое.',
    reward: 'Отложенное яблоко в сумке',
  },
  mixedRequests: {
    id: 'chapter-01-10',
    noun: 'book',
    article: 'a',
    title: 'Список перед дорогой',
    quest: 'Собери книгу, апельсин и указанный ключ по трём просьбам.',
    reward: 'Список выполнен',
  },
  newWords: {
    id: 'chapter-01-11',
    noun: 'robot',
    article: 'a',
    title: 'Помощник и зонт',
    quest: 'Выбери помощника, отправь его к двери и возьми зонт.',
    reward: 'Помощник готов',
  },
  chapterFinale: {
    id: 'chapter-01-12',
    noun: 'orange',
    article: 'an',
    title: 'Дорога огней ждёт',
    quest:
      'Собери яблоки и яйца для попутчиков, затем выполни три последние просьбы.',
    reward: 'Итоговая просьба выполнена',
  },
} as const;

export const vocabulary = {
  key: {
    translation: 'ключ',
    sound: '/k/',
    article: 'a',
    explanation: 'key — ключ, /kiː/. Начинается с согласного /k/.',
  },
  apple: {
    translation: 'яблоко',
    sound: '/æ/',
    article: 'an',
    explanation: 'apple — яблоко, /ˈæp.əl/. Начинается с гласного /æ/.',
  },
  book: {
    translation: 'книга',
    sound: '/b/',
    article: 'a',
    explanation:
      'book — книга, /bʊk/. Первый звук /b/ — согласный. Книги можно посчитать; здесь book означает одну книгу.',
  },
  orange: {
    translation: 'апельсин',
    sound: '/ɒ/',
    article: 'an',
    explanation:
      'Orange — апельсин. Здесь речь о фрукте, не о цвете. Первый звук гласный: an orange.',
  },
  robot: {
    translation: 'робот',
    sound: '/r/',
    article: 'a',
    explanation:
      'robot — робот, /ˈrəʊ.bɒt/ в британском варианте. Первый звук /r/ — согласный. Роботов можно посчитать; robot здесь — один робот.',
  },
  umbrella: {
    translation: 'зонт',
    sound: '/ʌ/',
    article: 'an',
    explanation:
      'Umbrella — зонт, /ʌmˈbrel.ə/. Первый звук /ʌ/ — гласный: an umbrella. Выбираем по звуку, а не по букве u.',
  },
} as const;

const basicRule =
  'A/an — неопределённый артикль. В этих просьбах нужен один любой предмет. Перед согласным звуком следующего слова ставим a, перед гласным — an. The используем, если собеседник понимает, какой предмет нужен: например, мы его показали или выбрали вместе. Просто повторить название недостаточно.';
const chainRule =
  'Сначала подходит любой предмет: a key или an apple. Кот откладывает один на виду у Люми. Теперь оба знают, какой выбран, и следующая просьба — the key или the apple — относится к нему. Если понадобится другой любой предмет, снова подойдёт a/an.';
const routes = [
  '↑ ↑ ↓ ← ← ← ← ↑ → → ↓ → ↑',
  '↑ ↑ ↓ ← ↑',
  '↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑',
];
type StageOptions = {
  chapter: number;
  part: number;
  total: number;
  noun: keyof typeof vocabulary;
  article: 'a' | 'an' | 'the';
  title: string;
  quest: string;
  introduction: string[];
  success: string[];
  select?: boolean;
  carry?: boolean;
  pointed?: boolean;
  order?: readonly ['a' | 'an' | 'the', 'a' | 'an' | 'the', 'a' | 'an' | 'the'];
  destination?: 'bag' | 'door';
  continuation?: LevelDefinition;
};
function stage(o: StageOptions): LevelDefinition {
  const word = vocabulary[o.noun];
  const order = o.order ?? ['a', 'an', 'the'];
  const group = o.carry
    ? `c${o.chapter}-shared`
    : o.select
      ? `c${o.chapter}-shared`
      : `c${o.chapter}-${o.part}`;
  const objects = ['слева', 'посередине', 'справа'].map((position, i) => ({
    id: `${group}-${i}`,
    noun: o.noun,
    label: `${word.translation} ${position}`,
  }));
  const targetKnown = o.article === 'the';
  const destination = o.destination ?? 'bag';
  const contextFeedback = targetKnown
    ? `${word.article} ${o.noun} — верная форма, но сейчас нужен именно ${o.carry ? 'ранее выбранный' : 'указанный котом'} предмет: the ${o.noun}. Он остаётся на месте. Можно отменить ходы и заменить артикль.`
    : `the ${o.noun} — грамматически верная форма, но в этой просьбе ни один предмет не выделен: подойдёт любой один. Нужна просьба ${word.article} ${o.noun}. Предметы пока остаются на месте; можно отменить ходы.`;
  return {
    id: `chapter-01-${o.chapter}-${o.part}`,
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
      ...order.map((article, i) => ({
        id: article,
        kind: 'word' as const,
        word: article,
        x: 1 + i * 2,
        y: 1,
      })),
      { id: o.noun, kind: 'word', word: o.noun, x: 4, y: 2 },
    ],
    reference: {
      objects,
      indicatedId: o.pointed ? objects[1]!.id : null,
      markerLabel: o.select || o.carry ? 'Наш выбор' : 'Указанный предмет',
    },
    carryReference: o.carry ?? false,
    answers: [
      {
        words: [o.article, o.noun],
        goal: true,
        effect: {
          type: o.select ? 'select' : 'deliver',
          target: targetKnown ? 'known' : 'any',
          destination,
        },
      },
      {
        words: [targetKnown ? word.article : 'the', o.noun],
        goal: false,
        feedback: contextFeedback,
      },
    ],
    mistakes: [
      {
        words: [word.article === 'a' ? 'an' : 'a', o.noun],
        reason: 'article',
        feedback: `${o.noun} начинается со звука ${word.sound}; для неопределённого артикля нужна форма ${word.article}. ${targetKnown ? `Но здесь нужен известный обоим предмет: the ${o.noun}.` : `Подойдёт любой один: ${word.article} ${o.noun}.`} Предметы не перемещены. Можно отменить ходы.`,
      },
    ],
    presentation: {
      title: `${o.title} · ${o.chapter === 12 ? o.part + 4 : o.part} из ${o.chapter === 12 ? o.total + 4 : o.total}`,
      noun: o.noun,
      quest: o.quest,
      introduction: o.introduction,
      success: o.success,
      rule: `${word.explanation} ${o.carry || o.select ? chainRule : basicRule} Пример для этой просьбы: ${o.article} ${o.noun}.`,
      hint: `Нужно ${o.article} ${o.noun}. Из начального положения этой части: ${routes[order.indexOf(o.article)]}. Лишние таблички оставь вне рамки. Если блок застрял, отменяй ходы; меню перезапускает весь эпизод.`,
      destination,
    },
    ...(o.continuation ? { continuation: o.continuation } : {}),
  };
}

const keyReturn = stage({
  chapter: 8,
  part: 2,
  total: 2,
  noun: 'key',
  article: 'the',
  title: 'Тот же ключ',
  carry: true,
  order: ['the', 'a', 'an'],
  quest: 'Попроси отложенный ключ — тот самый, который кот только что выбрал.',
  introduction: [
    'Вот выбранный ключ — я отложил его отдельно. Два других пока оставим здесь.',
    'Попроси положить в сумку этот ключ. Мы уже выбрали его вместе, теперь нужен the key.',
  ],
  success: [
    'В сумку отправился именно отложенный ключ. Два других не тронуты.',
    'Почему первая просьба была a key, а следующая — the key?',
  ],
});
const appleReturn = stage({
  chapter: 9,
  part: 2,
  total: 2,
  noun: 'apple',
  article: 'the',
  title: 'То же яблоко',
  carry: true,
  order: ['an', 'the', 'a'],
  quest: 'Попроси именно яблоко, отложенное после первой просьбы.',
  introduction: [
    'Вот яблоко, которое я только что отложил.',
    'Передай просьбу о том же яблоке. Не нужно выбирать новый плод.',
  ],
  success: [
    'Отложенное яблоко в сумке. Два других остались на столе.',
    'Почему теперь the apple, а не an apple?',
  ],
});
const mixedKey = stage({
  chapter: 10,
  part: 3,
  total: 3,
  noun: 'key',
  article: 'the',
  title: 'Указанный ключ',
  pointed: true,
  order: ['an', 'a', 'the'],
  quest:
    'Кот указывает на средний ключ — от почтового ящика. Попроси именно его.',
  introduction: [
    'Видишь средний ключ? Он от почтового ящика у станции. Остальные ключи от других замков. Возьмём именно этот.',
    'Какой артикль нужен, если мы просим именно этот ключ?',
  ],
  success: [
    'Ключ тоже в сумке. Теперь есть и книга для станции, и перекус.',
    'Что определяло выбор артиклей в этих трёх просьбах?',
  ],
});
const mixedOrange = stage({
  chapter: 10,
  part: 2,
  total: 3,
  noun: 'orange',
  article: 'an',
  title: 'Апельсин для привала',
  order: ['the', 'an', 'a'],
  quest: 'Попроси один любой апельсин из трёх для привала.',
  introduction: [
    vocabulary.orange.explanation,
    'На столе три апельсина. Возьмём один — любой.',
  ],
  success: [
    'Один апельсин положен в сумку. Осталось выполнить просьбу о ключе.',
  ],
  continuation: mixedKey,
});
const umbrella = stage({
  chapter: 11,
  part: 3,
  total: 3,
  noun: 'umbrella',
  article: 'an',
  title: 'Зонт от дождя',
  order: ['a', 'the', 'an'],
  quest: 'Попроси один любой зонт в дорогу.',
  introduction: [
    vocabulary.umbrella.explanation,
    'У двери три зонта, все целые. Для дороги подойдёт любой.',
  ],
  success: [
    'Зонт у нас. Помощник ждёт у двери; осталось закончить сборы.',
    'Как правильно выбирать между a, an и the?',
  ],
});
const robotReturn = stage({
  chapter: 11,
  part: 2,
  total: 3,
  noun: 'robot',
  article: 'the',
  title: 'Наш помощник',
  carry: true,
  destination: 'door',
  order: ['a', 'the', 'an'],
  quest: 'Позови к двери именно робота, которого только что выбрали.',
  introduction: [
    'Помощник уже подошёл к стойке. Теперь позови его к двери.',
    'Нужен тот же робот, которого мы только что выбрали. Он пойдёт рядом с Люми.',
  ],
  success: ['Помощник ждёт у двери. Возьмём зонт — дождь всё не кончается.'],
  continuation: umbrella,
});
const finalKeyReturn = stage({
  chapter: 12,
  part: 3,
  total: 3,
  noun: 'key',
  article: 'the',
  title: 'Последняя просьба',
  carry: true,
  order: ['the', 'an', 'a'],
  quest: 'Попроси тот же ключ, который кот отложил в предыдущей части.',
  introduction: [
    'Вот ключ, который мы выбрали. Передай последнюю просьбу — о том же ключе.',
  ],
  success: [
    'Ключ в сумке. Кажется, ничего не забыли. Пора в дорогу, Люми!',
    'Перед выходом вспомним: когда нужен a/an, когда the, а когда в наших просьбах можно обойтись без артикля?',
  ],
});
const finalKey = stage({
  chapter: 12,
  part: 2,
  total: 3,
  noun: 'key',
  article: 'a',
  title: 'Запасной ключ',
  select: true,
  order: ['an', 'a', 'the'],
  quest: 'Попроси отложить один любой запасной ключ, не класть его в сумку.',
  introduction: [
    'На стойке три запасных ключа. Попроси меня отложить один — подойдёт любой.',
  ],
  success: ['Вот выбранный ключ. Теперь попросим положить его в сумку.'],
  continuation: finalKeyReturn,
});

export const closingLevels = {
  keyChain: stage({
    chapter: 8,
    part: 1,
    total: 2,
    noun: 'key',
    article: 'a',
    title: 'Сначала любой ключ',
    select: true,
    quest:
      'Попроси отложить один любой запасной ключ. В сумку его пока не кладём.',
    introduction: [
      'Возьмём запасной ключ. Любой из трёх подойдёт, но в сумку его пока не кладём: попроси меня отложить a key.',
      'После этого попроси тот же ключ: the key. Ты будешь видеть, какой я выбрал. The появится потому, что речь пойдёт о конкретном ключе, а не просто из-за повтора слова.',
    ],
    success: [
      'Вот выбранный ключ. Он пока лежит отдельно; теперь попроси положить его в сумку.',
    ],
    continuation: keyReturn,
  }),
  appleChain: stage({
    chapter: 9,
    part: 1,
    total: 2,
    noun: 'apple',
    article: 'an',
    title: 'Сначала любое яблоко',
    select: true,
    order: ['the', 'a', 'an'],
    quest:
      'Попроси отложить одно любое яблоко. Следом понадобится тот же плод.',
    introduction: [
      'Так же выберем яблоко. Все три хорошие — подойдёт любое.',
      vocabulary.apple.explanation +
        ' Попроси одно любое яблоко и запомни, какое яблоко я отложу.',
    ],
    success: ['Вот выбранное яблоко. Следующая просьба будет о нём.'],
    continuation: appleReturn,
  }),
  mixedRequests: stage({
    chapter: 10,
    part: 1,
    total: 3,
    noun: 'book',
    article: 'a',
    title: 'Книга для станции',
    order: ['a', 'an', 'the'],
    quest: 'Возьми одну любую книгу из трёх для библиотеки станции.',
    introduction: [
      vocabulary.book.explanation,
      'В библиотеке станции ждут книги. Возьмём одну из этих трёх — подойдёт любая.',
    ],
    success: [
      'Одна книга отправилась в сумку. Следующая просьба — о перекусе.',
    ],
    continuation: mixedOrange,
  }),
  newWords: stage({
    chapter: 11,
    part: 1,
    total: 3,
    noun: 'robot',
    article: 'a',
    title: 'Выбираем помощника',
    select: true,
    order: ['an', 'a', 'the'],
    destination: 'door',
    quest: 'Позови одного любого робота-почтальона из трёх к стойке.',
    introduction: [
      vocabulary.robot.explanation,
      'У мастерской ждут три робота-почтальона. Любой сможет помочь Люми. Сначала позови одного к стойке; после выбора отправим именно его к двери.',
    ],
    success: [
      'Один робот подошёл к отдельному месту у стойки. Теперь мы оба знаем, кто пойдёт с тобой.',
    ],
    continuation: robotReturn,
  }),
  chapterFinale: createPluralPractice(
    stage({
      chapter: 12,
      part: 1,
      total: 3,
      noun: 'orange',
      article: 'an',
      title: 'Перед выходом',
      order: ['an', 'the', 'a'],
      quest: 'Попроси один любой апельсин для помощника Марты.',
      introduction: [
        'А теперь три знакомые просьбы перед выходом. Попробуй справиться сам. Если понадобится, правило и подсказка есть в журнале.',
        'Первая просьба: возьми один любой апельсин из трёх для помощника Марты.',
      ],
      success: [
        'Один апельсин собран. Теперь две связанные просьбы о запасном ключе.',
      ],
      continuation: finalKey,
    }),
  ),
} satisfies Record<keyof typeof closingEpisodes, LevelDefinition>;

export const closingReflections = {
  keyChain: {
    choices: [
      {
        id: 'chain-known',
        label: 'Общий выбор сделал один ключ известным обоим',
        feedback:
          'Верно. Сначала подходил любой один ключ; затем кот отложил один на виду. The key относилось к этому ключу. Причина — понятный обоим предмет, а не сам номер упоминания.',
      },
      {
        id: 'chain-repeat',
        label: 'Любое второе слово key требует the',
        feedback:
          'Повторять слово недостаточно. Если во второй просьбе нужен другой любой ключ, возможно a key. Здесь the относится к одному ключу, выбранному на глазах у обоих.',
      },
    ],
    correct: 'chain-known',
  },
  appleChain: {
    choices: [
      {
        id: 'chain-sound',
        label: 'После первого хода apple перестало начинаться с гласного',
        feedback:
          'Звук /æ/ не изменился. Изменилась ситуация: одно яблоко стало известно обоим. Поэтому the apple вместо просьбы о любом плоде.',
      },
      {
        id: 'chain-known',
        label: 'Мы оба знаем, какое яблоко было отложено',
        feedback:
          'Верно. Мы видели, какое яблоко кот отложил, и попросили именно его: the apple. Гласный звук этого не меняет.',
      },
    ],
    correct: 'chain-known',
  },
  mixedRequests: {
    choices: [
      {
        id: 'mixed-sound',
        label: 'Только первая буква существительного',
        feedback:
          'Сначала решаем, нужен любой предмет или конкретный. Звук помогает выбрать между a и an, но не между ними и the.',
      },
      {
        id: 'mixed-context',
        label: 'Ситуация, затем звук для выбора a/an',
        feedback:
          'Верно: любая книга — a book, любой апельсин — an orange, указанный ключ — the key. Ситуация определяет a/an или the, звук определяет a или an.',
      },
    ],
    correct: 'mixed-context',
  },
  newWords: {
    choices: [
      {
        id: 'mixed-context',
        label: 'Сначала смысл, затем звук для a/an',
        feedback:
          'Верно: один любой робот — a robot, выбранный помощник — the robot, один любой зонт — an umbrella. Значение предмета и ситуация важнее расположения таблички.',
      },
      {
        id: 'mixed-sound',
        label: 'The нужно для людей, an — для вещей',
        feedback:
          'Такого правила нет. Робот, ключ и яблоко могут быть понятны обоим и получать the. Для одного любого зонта an выбирается из-за гласного звука /ʌ/.',
      },
    ],
    correct: 'mixed-context',
  },
  chapterFinale: {
    choices: [
      {
        id: 'final-always',
        label: 'Перед каждым существительным нужен a, an или the',
        feedback:
          'Вспомни apples и eggs: когда нам подходили любые, мы просили их без артикля. A/an с множественным числом не ставим. The понадобился, когда мы попросили именно отложенные яблоки или яйца.',
      },
      {
        id: 'final-context',
        label: 'A/an — один любой; apples — любые; the — конкретные',
        feedback:
          'Верно: нужен тот ключ, который мы уже выбрали. С несколькими предметами было так же: apples — любые яблоки, the apples — выбранные. A/an оставляем для одного предмета. Сборы закончены — глава 1 пройдена!',
      },
    ],
    correct: 'final-context',
  },
} as const;
