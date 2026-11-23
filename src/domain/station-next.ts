import type { LevelDefinition, Piece } from './levels';
import { stationPeople, type MessageContext } from './station-chapter';

export const stationNextEpisodes = {
  'chapter-02-06': {
    id: 'chapter-02-06',
    noun: "I'm",
    article: '',
    title: 'То же сообщение короче',
    quest: 'Полная и сокращённая формы be: смысл остаётся прежним.',
    reward: 'Короткие записи',
  },
  'chapter-02-07': {
    id: 'chapter-02-07',
    noun: 'I',
    article: '',
    title: 'Бирки поменялись местами',
    quest: 'Выбери местоимение по ситуации: говорящий, собеседник или предмет.',
    reward: 'Бирки на своих местах',
  },
  'chapter-02-08': {
    id: 'chapter-02-08',
    noun: 'robots',
    article: '',
    title: 'Один робот, два робота',
    quest: 'Подпиши одного помощника и группы из двух предметов.',
    reward: 'Груз пересчитан',
  },
  'chapter-02-09': {
    id: 'chapter-02-09',
    noun: 'boxes',
    article: '',
    title: 'Ящики с историями',
    quest: 'Boxes, stories, keys: три способа записать множественное число.',
    reward: 'Библиотечный груз подписан',
  },
  'chapter-02-10': {
    id: 'chapter-02-10',
    noun: 'people',
    article: '',
    title: 'Не каждое слово получает s',
    quest: 'Child / children и person / people в списке пассажиров.',
    reward: 'Список пассажиров проверен',
  },
} as const;

type NewEpisode = keyof typeof stationNextEpisodes;
export type StationLesson = {
  suffix: string;
  words: readonly string[];
  alternatives?: readonly (readonly string[])[];
  distractors?: readonly string[];
  message: Omit<MessageContext, 'people'>;
  reference?: LevelDefinition['reference'];
  quest: string;
  introduction: readonly string[];
  success: string;
  rule: string;
  hint: string;
  contractions?: boolean;
  independent?: boolean;
  mistakes?: LevelDefinition['mistakes'];
  frameLength?: number;
  wide?: boolean;
};

const shorts: Readonly<Record<string, string>> = {
  I: "I'm",
  You: "You're",
  He: "He's",
  She: "She's",
  It: "It's",
};

export function stationLesson(
  id: string,
  title: string,
  data: StationLesson,
): LevelDefinition {
  const patterns = [data.words, ...(data.alternatives ?? [])];
  const words = [
    ...new Set([
      ...patterns.flat(),
      ...(data.distractors ?? []),
      ...(data.contractions
        ? patterns.flatMap((p) => (shorts[p[0]!] ? [shorts[p[0]!]!] : []))
        : []),
    ]),
  ];
  // Empty reading frame in every part. The review changes word order and positions.
  const columns = data.independent || data.wide ? 9 : 7;
  const frameLength = data.frameLength ?? data.words.length;
  const firstColumn = Math.floor((columns - frameLength) / 2);
  const positions = data.independent
    ? [
        { x: 5, y: 3 },
        { x: 2, y: 2 },
        { x: 6, y: 2 },
        { x: 3, y: 3 },
      ].slice(0, data.words.length)
    : data.words.map((_, i) => ({ x: i + firstColumn, y: 2 }));
  const extras = (
    data.independent || data.wide
      ? [
          { x: 1, y: 4 },
          { x: 3, y: 4 },
          { x: 5, y: 4 },
          { x: 7, y: 4 },
          { x: 1, y: 2 },
          { x: 7, y: 2 },
          { x: 6, y: 3 },
        ]
      : [
          { x: 1, y: 4 },
          { x: 3, y: 4 },
          { x: 5, y: 4 },
          { x: 1, y: 2 },
          { x: 5, y: 2 },
          { x: 2, y: 3 },
          { x: 4, y: 3 },
          { x: 3, y: 3 },
          { x: 1, y: 3 },
          { x: 5, y: 3 },
        ]
  ).filter(
    (p) => !positions.some((other) => p.x === other.x && p.y === other.y),
  );
  const pieces: Piece[] = words.map((word, i) => ({
    id: `word-${i}`,
    kind: 'word',
    word,
    ...(i < data.words.length ? positions[i]! : extras[i - data.words.length]!),
  }));
  return {
    id,
    revision: 1,
    columns,
    rows: 6,
    walls: [],
    slots: Array.from({ length: frameLength }, (_, i) => ({
      x: i + firstColumn,
      y: 1,
    })),
    start: { x: Math.floor(columns / 2), y: 5 },
    pieces,
    allowContractions: data.contractions,
    message: { ...data.message, people: stationPeople },
    reference: data.reference,
    answers: patterns.map((words) => ({
      words,
      goal: true,
      effect: { type: 'record-message' },
    })),
    mistakes: data.mistakes ?? [],
    presentation: {
      title,
      noun: data.words.at(-1)!,
      quest: data.quest,
      introduction: data.introduction,
      success: [data.success],
      speakers: {
        task: data.introduction.map(() => data.message.speaker),
        success: [data.message.speaker],
      },
      rule: data.rule,
      hint: data.hint,
      destination: 'register',
    },
  };
}

function chain(
  episode: NewEpisode,
  parts: readonly StationLesson[],
  question: string,
): LevelDefinition {
  let next: LevelDefinition | undefined;
  for (let i = parts.length - 1; i >= 0; i--) {
    const data = parts[i]!;
    const level = stationLesson(
      i === 0 ? episode : `${episode}-${data.suffix}`,
      stationNextEpisodes[episode].title,
      data,
    );
    if (next) level.continuation = next;
    else {
      level.presentation = {
        ...level.presentation!,
        success: [data.success, question],
        speakers: {
          ...level.presentation!.speakers!,
          success: [data.message.speaker, data.message.speaker],
        },
      };
    }
    next = level;
  }
  return next!;
}

const contractionRule =
  'Сокращение — короткая запись той же конструкции: I am → I’m; you are → you’re; he is → he’s; she is → she’s; it is → it’s. Апостроф ’ стоит на месте пропущенных букв. В I’m исчезла a, в you’re — a, в he’s / she’s / it’s — i. Произношение тоже становится короче. I’m Lumi и I am Lumi означают одно и то же. Это обычные формы в разговоре; полная форма тоже верна. Здесь ’s сокращает is, но в других конструкциях у него бывают и другие значения. На поле сокращение — одна плитка: ставь слова рядом, без пропусков; пустая клетка может быть с любого края. Для полной формы нужны все клетки.';
const rolesRule =
  'Личное местоимение выбираем по роли в сообщении: I — тот, кто говорит; you — тот, к кому обращаются; he / she — другой герой; it — понятный участникам обычный предмет. Формы be: I am, you are, he / she / it is. Имя ставим без артикля; описание одного фонаря или робота — с a, зонта — с an. Сокращённые формы сохраняют смысл: I’m, you’re, he’s, she’s, it’s. На поле ставь слова подряд; с сокращением пустую клетку можно оставить с любого края. Сообщение должно подходить тому, кто говорит, и тому, о ком или о чём речь.';
const umbrella = {
  objects: [
    { id: 'review-umbrella', noun: 'umbrella', label: 'зонт у стойки' },
    {
      id: 'review-egg',
      noun: 'egg',
      label: 'яйцо на карточке',
      display: 'card' as const,
    },
  ],
  indicatedId: 'review-umbrella',
  markerLabel: 'Зонт у стойки',
};

const contractions = chain(
  'chapter-02-06',
  [
    {
      suffix: 'lumi',
      words: ['I', 'am', 'Lumi'],
      alternatives: [['I', 'am', 'Marta']],
      contractions: true,
      message: { speaker: 'lumi', recipient: 'tik', intent: 'introduce-self' },
      quest:
        'Помоги Люми подписать свою бирку. Можно использовать полную или сокращённую форму.',
      introduction: [
        'На этой бирке тесновато. Можно представиться короче: I’m Lumi вместо I am Lumi. Обе фразы означают «Я Люми».',
        'I’m — сокращённая форма I am. Значок ’ называется апострофом: здесь он стоит вместо буквы a из am. Поэтому одной плитки I’m хватит вместо I и am.',
        'Поставь слова рядом. I’m Lumi займёт две клетки; пустую можно оставить слева или справа. Можно собрать и I am Lumi — тогда нужны все три.',
      ],
      success:
        'Готово! I am Lumi и I’m Lumi — в обоих случаях я представляюсь.',
      rule: contractionRule,
      hint: 'Сейчас говорит Люми: I am Lumi или I’m Lumi. Поставь сокращение и имя рядом, без пустой клетки между ними.',
    },
    {
      suffix: 'you',
      words: ['You', 'are', 'a', 'robot'],
      alternatives: [['You', 'are', 'a', 'lantern']],
      contractions: true,
      message: {
        speaker: 'marta',
        recipient: 'tik',
        intent: 'describe-recipient',
      },
      quest: 'Марта обращается к Тику и называет его роботом.',
      introduction: [
        'Тик, подпишем и твою бирку: You are a robot — «Ты робот». Можно короче: You’re a robot. В you’re апостроф заменяет букву a из are.',
        'Выбирай любую форму. Перед robot всё равно нужен артикль a.',
      ],
      success:
        'You are a robot или You’re a robot — я говорю тебе одно и то же: «Ты робот».',
      rule: contractionRule,
      hint: 'Собери You are a robot или You’re a robot. Во втором случае пустую клетку можно оставить с любого края.',
    },
    {
      suffix: 'he',
      words: ['He', 'is', 'a', 'robot'],
      alternatives: [['He', 'is', 'a', 'lantern']],
      contractions: true,
      message: {
        speaker: 'marta',
        recipient: 'lumi',
        subject: 'tik',
        intent: 'describe-third-party',
      },
      quest: 'Марта говорит Люми о Тике. Запиши, что Тик — робот.',
      introduction: [
        'Люми, вот Тик. О нём я скажу: He is a robot — «Он робот». Короткая форма — He’s a robot: в he’s пропущена i из is.',
        'Плитка He’s заменяет сразу he и is.',
      ],
      success:
        'He’s a robot — «Он робот». Запись короче, но я всё так же говорю о Тике.',
      rule: contractionRule,
      hint: 'О Тике: He is a robot или He’s a robot.',
    },
    {
      suffix: 'she',
      words: ['She', 'is', 'Marta'],
      alternatives: [['She', 'is', 'Lumi']],
      contractions: true,
      independent: true,
      message: {
        speaker: 'tik',
        recipient: 'lumi',
        subject: 'marta',
        intent: 'name-third-party',
      },
      quest: 'Тик называет Люми имя Марты. Выбери удобную форму записи.',
      introduction: [
        'Люми, теперь подпишем бирку Марты. Я говорю о ней, поэтому беру she. She is можно сократить до she’s: апостроф заменяет i.',
        'Помоги мне назвать её имя. Подойдёт и полная, и короткая запись.',
      ],
      success:
        'She is Marta и She’s Marta означают «Она Марта». Имя не требует артикля.',
      rule: contractionRule,
      hint: 'Тик говорит о Марте: She is Marta или She’s Marta.',
    },
    {
      suffix: 'it',
      words: ['It', 'is', 'an', 'umbrella'],
      alternatives: [['It', 'is', 'an', 'egg']],
      contractions: true,
      message: { speaker: 'tik', recipient: 'lumi', intent: 'describe-object' },
      reference: umbrella,
      quest: 'Опиши зонт под указателем. Полная и короткая формы подходят.',
      introduction: [
        'Осталось подписать находку у стойки. It is сокращается до it’s: апостроф заменяет i из is. Значение то же.',
        'Посмотри на указатель и подпиши находку. Можно использовать it is или it’s.',
      ],
      success:
        'It is an umbrella и It’s an umbrella — «Это зонт». An остаётся на месте: сокращение его не заменяет.',
      rule: contractionRule,
      hint: 'Зонт: It is an umbrella или It’s an umbrella.',
    },
  ],
  'Что меняется, когда мы записываем I am как I’m?',
);

const review = chain(
  'chapter-02-07',
  [
    {
      suffix: 'marta',
      words: ['I', 'am', 'Marta'],
      alternatives: [
        ['You', 'are', 'Marta'],
        ['I', 'am', 'Lumi'],
      ],
      contractions: true,
      independent: true,
      message: {
        speaker: 'marta',
        recipient: 'lumi',
        intent: 'introduce-self',
      },
      quest: 'Марта говорит о себе Люми: «Я Марта». Подпиши её бирку.',
      introduction: [
        'Ветер перемешал бирки. Люми, начнём с моей: я хочу представиться тебе.',
        'Собери для меня «Я Марта». Слова на поле перепутались — найди нужные.',
      ],
      success:
        'I am Marta — «Я Марта». Здесь I означает меня: я сама называю своё имя.',
      rule: rolesRule,
      hint: 'Автор — Марта. О себе: I am Marta или I’m Marta.',
    },
    {
      suffix: 'tik',
      words: ['You', 'are', 'a', 'robot'],
      alternatives: [
        ['I', 'am', 'a', 'robot'],
        ['You', 'are', 'a', 'lantern'],
      ],
      independent: true,
      contractions: true,
      message: {
        speaker: 'lumi',
        recipient: 'tik',
        intent: 'describe-recipient',
      },
      quest: 'Помоги Люми сказать Тику: «Ты робот».',
      introduction: [
        'Тик, эту бирку я подписываю для тебя. На ней будет не имя, а то, кто ты.',
        'На бирке будет «Ты робот». Я обращаюсь к тебе, поэтому нужно слово для собеседника.',
      ],
      success:
        'You are a robot — «Ты робот». Я обращаюсь к тебе, поэтому you означает тебя. А I am a robot означало бы «Я робот», хотя я фонарь.',
      rule: rolesRule,
      hint: 'Обращение к Тику: You are a robot.',
    },
    {
      suffix: 'umbrella',
      words: ['It', 'is', 'an', 'umbrella'],
      alternatives: [
        ['He', 'is', 'an', 'umbrella'],
        ['It', 'is', 'an', 'egg'],
      ],
      independent: true,
      contractions: true,
      message: { speaker: 'tik', recipient: 'lumi', intent: 'describe-object' },
      reference: umbrella,
      quest: 'Тик описывает Люми обычный зонт под указателем.',
      introduction: [
        'Теперь проверим бирку находки. Я показываю тебе зонт у стойки, Люми.',
        'Подпиши этот зонт. Он обычный предмет; яйцо нарисовано на соседней карточке.',
      ],
      success:
        'It is an umbrella. It обозначает указанный зонт. Русское слово «зонт» мужского рода, но здесь всё равно нужно it.',
      rule: rolesRule,
      hint: 'Указан обычный зонт: It is an umbrella.',
    },
  ],
  'От чего зависел выбор I, you и it в этих трёх сообщениях?',
);

const pluralRule =
  'Существительное называет предмет, существо или человека. Единственное число — один: a robot, один робот. Множественное число — больше одного: robots, роботы. У многих английских существительных добавляется окончание -s: robot → robots, book → books, key → keys. Two означает «два / две»: two robots — два робота. A/an ставят с одним исчисляемым предметом, поэтому a robots и an robots не подходят. После two нужно множественное число: two books, а не two book. Сейчас собираем подпись — сочетание слов, а не полное предложение. Be не нужен в названии груза. The с множественным числом тоже возможен, если речь об определённых предметах; здесь записываем количество и название.';
const spellingRule =
  'Множественное число: box (ящик) → boxes (ящики), story (рассказ) → stories (рассказы), key (ключ) → keys (ключи). После x добавляем -es: box + es. Если перед конечной y стоит согласная буква, y меняется на ies: story → stories, перед y стоит r. Если перед y гласная буква, добавляем -s и сохраняем y: key → keys, перед y стоит e. Английские гласные буквы в этом правиле — a, e, i, o, u. Здесь смотрим на буквы; выбор a/an, в отличие от этого правила, зависит от звука. Это не все способы образования множественного числа: есть исключения, их изучим отдельно. Two boxes / two stories / two keys — подписи к группам из двух, без a/an.';
const irregularRule =
  'У некоторых существительных особые формы множественного числа: child — ребёнок, children — дети; person — человек, people — люди. Такие формы запоминают парой: a child → two children; a person → two people. Children и people в этих значениях уже множественное число: добавлять ещё -s не нужно. A/an с ними здесь не ставим. Для обычного списка пассажиров используем people; persons встречается в официальной речи, поэтому это не «несуществующее слово». Не все слова меняются по-особому: robot → robots по уже знакомому правилу. На поле сейчас подписи к записям, а не предложения с be.';

type Pair = {
  singular: string;
  plural: string;
  one: string;
  two: string;
  record?: boolean;
};
const robot = {
  singular: 'robot',
  plural: 'robots',
  one: 'один робот',
  two: 'два робота',
};
const book = {
  singular: 'book',
  plural: 'books',
  one: 'одна книга',
  two: 'две книги',
};
const key = {
  singular: 'key',
  plural: 'keys',
  one: 'один ключ',
  two: 'два ключа',
};
const box = {
  singular: 'box',
  plural: 'boxes',
  one: 'один ящик',
  two: 'два ящика',
  record: true,
};
const story = {
  singular: 'story',
  plural: 'stories',
  one: 'один рассказ',
  two: 'два рассказа',
  record: true,
};
const child = {
  singular: 'child',
  plural: 'children',
  one: 'один ребёнок',
  two: 'два ребёнка',
  record: true,
};
const person = {
  singular: 'person',
  plural: 'people',
  one: 'один человек',
  two: 'два человека',
  record: true,
};

export function group(data: {
  pair: Pair;
  other: Pair;
  count?: 1 | 2;
  suffix: string;
  rule: string;
  introduction: readonly string[];
  success: string;
  speaker?: 'tik' | 'marta';
}): StationLesson {
  const { pair, other, suffix } = data;
  const count = data.count ?? 2;
  const noun = count === 1 ? pair.singular : pair.plural;
  const targetLabel = count === 1 ? pair.one : pair.two;
  const words = [count === 1 ? 'a' : 'two', noun];
  const alternatives = [
    [count === 1 ? 'two' : 'a', count === 1 ? pair.plural : pair.singular],
    ['two', other.plural],
    ['a', other.singular],
  ];
  return {
    suffix,
    words,
    alternatives,
    message: {
      speaker: data.speaker ?? 'marta',
      recipient: 'lumi',
      intent: 'label-group',
    },
    reference: {
      objects: [
        {
          id: `${suffix}-one`,
          noun: pair.singular,
          label: pair.one,
          ...(pair.record
            ? { display: 'record' as const, caption: pair.one }
            : {}),
        },
        {
          id: `${suffix}-two`,
          noun: pair.plural,
          count: 2,
          label: pair.two,
          ...(pair.record
            ? { display: 'record' as const, caption: pair.two }
            : {}),
        },
      ],
      indicatedId: `${suffix}-${count === 1 ? 'one' : 'two'}`,
      markerLabel: targetLabel,
    },
    quest: `Подпиши запись под указателем: ${targetLabel}. Нужны количество и название.`,
    introduction: data.introduction,
    success: data.success,
    rule: data.rule,
    hint: `Для выбранной записи: ${words.join(' ')}. Это подпись, глагол be сюда не добавляем.`,
    mistakes: [pair, other].flatMap((p) => [
      {
        words: ['two', p.singular],
        reason: 'agreement' as const,
        feedback: `Two — два / две, поэтому нужно множественное число: ${p.plural}. ${p.singular} обозначает одного.`,
      },
      {
        words: ['a', p.plural],
        reason: 'article' as const,
        feedback: `A относится к одному исчисляемому предмету. ${p.plural} — множественное число; для двух: two ${p.plural}.`,
      },
    ]),
  };
}

const regular = chain(
  'chapter-02-08',
  [
    group({
      pair: robot,
      other: book,
      count: 1,
      suffix: 'one',
      rule: pluralRule,
      introduction: [
        'У стойки два заказа: для одного нужен один робот, для другого — два. Подпишем оба заказа, чтобы не перепутать.',
        'Слово robot называет робота. Такие слова называются существительными. Один робот — a robot, единственное число. Несколько — robots, множественное число. К robot добавили -s.',
        'Two значит «два». Two robots — два робота. A/an с множественным числом не ставим. Сейчас указатель у одного робота: начни с его подписи.',
      ],
      success:
        'A robot — один робот. Первый заказ подписан. Теперь нужен заказ на двух.',
    }),
    group({
      pair: robot,
      other: book,
      suffix: 'robots',
      rule: pluralRule,
      introduction: [
        'Указатель теперь у пары роботов. Запиши, сколько их и кто они.',
        'Слово two уже говорит о двух. В названии тоже должно быть множественное число.',
      ],
      success:
        'Two robots — два робота. После two у robot появилось -s: теперь слово обозначает нескольких роботов.',
    }),
    group({
      pair: book,
      other: robot,
      suffix: 'books',
      rule: pluralRule,
      introduction: [
        'Дорожная библиотека ждёт две книги. Book — «книга», books — «книги». Здесь тоже добавляем -s.',
        'Подпиши две книги. Запись о роботах сейчас не нужна.',
      ],
      success:
        'Two books — две книги. Окончание -s показывает множественное число.',
    }),
    group({
      pair: key,
      other: book,
      suffix: 'keys',
      rule: pluralRule,
      speaker: 'tik',
      introduction: [
        'Проверю ещё два запасных ключа. Key — «ключ», keys — «ключи». Помоги подписать эту пару.',
      ],
      success:
        'Two keys — два ключа. A key подошло бы к одному ключу, но не к этой паре.',
    }),
  ],
  'Почему к two robot нужно добавить s, а a robots не подходит?',
);

const spelling = chain(
  'chapter-02-09',
  [
    group({
      pair: box,
      other: book,
      suffix: 'boxes',
      rule: spellingRule,
      introduction: [
        'Прибыл груз для дорожной библиотеки. На накладной два ящика. Box — «ящик», boxes — «ящики».',
        'После x добавляем -es: box → boxes. Подпиши оба ящика.',
      ],
      success: 'Two boxes. После x появилось окончание -es. Ящики учтены.',
    }),
    group({
      pair: story,
      other: box,
      suffix: 'stories',
      rule: spellingRule,
      introduction: [
        'В ящиках лежат книги с рассказами. Story — «рассказ». В следующей записи указаны два рассказа — нужно подписать именно их.',
        'Story заканчивается на y. Перед y стоит согласная буква r, поэтому y меняется на ies: story → stories.',
        'На накладной подписано: «два рассказа». Собери английскую подпись.',
      ],
      success:
        'Two stories — два рассказа. Y после согласной r сменилась на ies.',
    }),
    group({
      pair: key,
      other: story,
      suffix: 'keys',
      rule: spellingRule,
      speaker: 'tik',
      introduction: [
        'У накладной лежат два ключа. В key тоже есть y, но перед ней гласная буква e.',
        'После гласной y сохраняется, добавляем только -s: key → keys. Подпиши пару ключей.',
      ],
      success:
        'Two keys. В stories и keys разные окончания: всё решает буква перед y.',
    }),
  ],
  'Почему story превращается в stories, а key — в keys?',
);

const irregular = chain(
  'chapter-02-10',
  [
    group({
      pair: child,
      other: robot,
      suffix: 'children',
      rule: irregularRule,
      speaker: 'tik',
      introduction: [
        'Груз проверили, остались пассажиры. В первой строке списка — два ребёнка. Переведём эту запись на английский.',
        'Child — «ребёнок», children — «дети». Это особая форма множественного числа. Запоминаем пару: child → children.',
        'Two children — два ребёнка. Children уже означает больше одного: ещё одно s не нужно. Подпиши выбранную запись.',
      ],
      success:
        'Two children — два ребёнка. Для нескольких детей нужно children, без дополнительного -s.',
    }),
    group({
      pair: person,
      other: child,
      suffix: 'people',
      rule: irregularRule,
      introduction: [
        'В соседней записи — два человека. Person значит «человек». О нескольких людях в обычной речи говорим people.',
        'A person — один человек, two people — два человека. Запомни эту пару. Слово people подходит, когда считаем людей без уточнения возраста.',
      ],
      success:
        'Two people — два человека. People здесь уже множественное число; a перед ним не ставим.',
    }),
    group({
      pair: robot,
      other: person,
      suffix: 'review',
      rule: irregularRule,
      introduction: [
        'Осталось подписать двух роботов, которые едут с нами. На поле есть и слова для людей — выбирай внимательно.',
        'Посмотри на указатель и выбери название. Вспомни, как получалось множественное число robot.',
      ],
      success:
        'Two robots. К robot добавляем -s; пары child — children и person — people запоминаем отдельно. Все записи проверены. Теперь можно рассказать, кто едет вместе.',
    }),
  ],
  'Как выбрать множественное число: robots, children или people?',
);

export const stationNextLevels = {
  'chapter-02-06': contractions,
  'chapter-02-07': review,
  'chapter-02-08': regular,
  'chapter-02-09': spelling,
  'chapter-02-10': irregular,
};

export const stationNextReflections = {
  'chapter-02-06': {
    correct: 'short-same',
    title: 'Что меняется при сокращении?',
    choices: [
      {
        id: 'short-new',
        label: 'Изменился тот, о ком говорят',
        feedback:
          'Нет. I am и I’m по-прежнему относятся к говорящему. Сокращение не меняет героя.',
      },
      {
        id: 'short-same',
        label: 'Запись стала короче, смысл тот же',
        feedback:
          'Верно. I’m — короткая форма I am. Апостроф отмечает пропущенную букву, а смысл сохраняется.',
      },
      {
        id: 'short-no-be',
        label: 'Глагол be исчез из предложения',
        feedback:
          'Be остался внутри сокращения. В I’m часть ’m передаёт am; это не просто I.',
      },
    ],
  },
  'chapter-02-07': {
    correct: 'roles-context',
    title: 'Кто говорит, кому и о чём?',
    choices: [
      {
        id: 'roles-name',
        label: 'У каждого героя всегда своё местоимение',
        feedback:
          'Марта скажет о себе I. Когда Люми обращается к ней, он скажет you. Одна и та же Марта может быть и говорящей, и собеседницей.',
      },
      {
        id: 'roles-russian',
        label: 'От рода слова в русском переводе',
        feedback:
          'Русский род не объясняет выбор. Обычный зонт здесь — it, а I и you зависят от участников разговора.',
      },
      {
        id: 'roles-context',
        label: 'От того, кто говорит, к кому обращается и что описывает',
        feedback:
          'Верно. О себе говорим I, к собеседнику обращаемся you, обычный предмет называем it. С I используем am, с you — are, с it — is.',
      },
    ],
  },
  'chapter-02-08': {
    correct: 'plural-count',
    title: 'Один или несколько?',
    choices: [
      {
        id: 'plural-count',
        label: 'Two требует множественного числа, a — одного предмета',
        feedback:
          'Верно. Two robots — два робота. A robot — один. A robots смешивает единственное и множественное число.',
      },
      {
        id: 'plural-two-only',
        label: 'После two форма существительного не важна',
        feedback:
          'Two значит «два», но к robot всё равно нужно добавить -s: two robots.',
      },
      {
        id: 'plural-any-s',
        label: 'S можно добавить к любому английскому слову',
        feedback:
          'Мы меняли число существительных robot, book и key. Это не правило для любого слова; даже у существительных есть другие формы.',
      },
    ],
  },
  'chapter-02-09': {
    correct: 'plural-y-letter',
    title: 'Посмотри перед y',
    choices: [
      {
        id: 'plural-y-always',
        label: 'Y всегда заменяется на ies',
        feedback:
          'В key перед y стоит гласная e, поэтому y остаётся: keys. В story перед y согласная r: stories.',
      },
      {
        id: 'plural-y-letter',
        label: 'В story перед y согласная r, в key — гласная e',
        feedback:
          'Верно. Согласная + y даёт ies, гласная + y — ys. Поэтому stories, но keys. А после x в box добавляем es: boxes.',
      },
      {
        id: 'plural-y-sound',
        label: 'Всё зависит от первого звука, как у a/an',
        feedback:
          'Здесь правило написания: смотрим на букву перед конечной y. Первый звук нужен для выбора a/an, это другая задача.',
      },
    ],
  },
  'chapter-02-10': {
    correct: 'plural-pairs',
    title: 'Обычная или особая форма?',
    choices: [
      {
        id: 'plural-extra-s',
        label: 'Добавить s к children и people',
        feedback:
          'Children и people в наших записях уже множественное число. Дополнительное s не нужно.',
      },
      {
        id: 'plural-all-change',
        label: 'У всех существительных нужно менять основу',
        feedback:
          'У robot достаточно -s: robots. Особые формы child → children и person → people запоминаем отдельно.',
      },
      {
        id: 'plural-pairs',
        label: 'Robots — по правилу; children и people — особые формы',
        feedback:
          'Верно. У robot добавляем -s, а для child и person нужны особые формы: children и people.',
      },
    ],
  },
} as const;
