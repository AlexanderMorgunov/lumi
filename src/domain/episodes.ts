import { closingEpisodes, closingReflections } from './closing-chapter';
import { stationReflection } from './station-chapter';
import { stationIdentityReflection } from './station-identity';
import { stationAddressReflection } from './station-address';
import { stationThirdReflection } from './station-third-person';
import { stationObjectsReflection } from './station-objects';
import { stationNextEpisodes, stationNextReflections } from './station-next';
import { departureEpisodes, departureReflections } from './station-departure';
import { finaleEpisodes, finaleReflections } from './station-finale';
export type EpisodeId =
  | keyof typeof finaleEpisodes
  | keyof typeof departureEpisodes
  | keyof typeof stationNextEpisodes
  | 'chapter-02-01'
  | 'chapter-02-02'
  | 'chapter-02-03'
  | 'chapter-02-04'
  | 'chapter-02-05'
  | 'cat'
  | 'key'
  | 'apple'
  | 'egg'
  | 'choiceKey'
  | 'choiceApple'
  | 'theKey'
  | 'theApple'
  | keyof typeof closingEpisodes;
export type MeaningChoice =
  | (typeof finaleReflections)[keyof typeof finaleReflections]['choices'][number]['id']
  | (typeof departureReflections)[keyof typeof departureReflections]['choices'][number]['id']
  | (typeof stationNextReflections)[keyof typeof stationNextReflections]['choices'][number]['id']
  | 'object-ordinary'
  | 'object-russian'
  | 'object-listener'
  | 'third-subject'
  | 'third-speaker'
  | 'third-listener'
  | 'address-tik'
  | 'address-lumi'
  | 'address-group'
  | 'identity-kind'
  | 'identity-stranger'
  | 'identity-after-am'
  | 'speaker-marta'
  | 'speaker-lumi'
  | 'speaker-listener'
  | 'any'
  | 'several'
  | 'specific'
  | 'vowel'
  | 'fruit'
  | 'many'
  | 'egg-any'
  | 'egg-many'
  | 'egg-specific'
  | 'choice-consonant'
  | 'choice-vowel'
  | 'choice-position'
  | 'choice-previous'
  | 'the-shared'
  | 'the-repeat'
  | 'the-sound'
  | 'apple-shared'
  | 'apple-always-an'
  | 'apple-repeat'
  | 'chain-known'
  | 'chain-repeat'
  | 'chain-sound'
  | 'mixed-sound'
  | 'mixed-context'
  | 'final-always'
  | 'final-context';

export const nextEpisodes: Record<EpisodeId, EpisodeId | null> = {
  'chapter-02-01': 'chapter-02-02',
  'chapter-02-02': 'chapter-02-03',
  'chapter-02-03': 'chapter-02-04',
  'chapter-02-04': 'chapter-02-05',
  'chapter-02-05': 'chapter-02-06',
  'chapter-02-06': 'chapter-02-07',
  'chapter-02-07': 'chapter-02-08',
  'chapter-02-08': 'chapter-02-09',
  'chapter-02-09': 'chapter-02-10',
  'chapter-02-10': 'chapter-02-11',
  'chapter-02-11': 'chapter-02-12',
  'chapter-02-12': 'chapter-02-13',
  'chapter-02-13': 'chapter-02-14',
  'chapter-02-14': 'chapter-02-15',
  'chapter-02-15': 'chapter-02-16',
  'chapter-02-16': 'chapter-02-17',
  'chapter-02-17': 'chapter-02-18',
  'chapter-02-18': 'chapter-02-19',
  'chapter-02-19': 'chapter-02-20',
  'chapter-02-20': null,
  cat: 'key',
  key: 'apple',
  apple: 'egg',
  egg: 'choiceKey',
  choiceKey: 'choiceApple',
  choiceApple: 'theKey',
  theKey: 'theApple',
  theApple: 'keyChain',
  keyChain: 'appleChain',
  appleChain: 'mixedRequests',
  mixedRequests: 'newWords',
  newWords: 'chapterFinale',
  chapterFinale: null,
};

export const episodes = {
  ...finaleEpisodes,
  ...departureEpisodes,
  ...stationNextEpisodes,
  'chapter-02-05': {
    id: 'chapter-02-05',
    noun: 'umbrella',
    article: 'an',
    title: 'Кто потерял зонт',
    quest: 'It is: описываем указанный обычный предмет и рисунок.',
    reward: 'Находка описана',
  },
  'chapter-02-04': {
    id: 'chapter-02-04',
    noun: 'She',
    article: '',
    title: 'О ком мы говорим',
    quest:
      'He / she и is: отличаем автора, собеседника и того, о ком сообщение.',
    reward: 'Записи о спутниках',
  },
  'chapter-02-03': {
    id: 'chapter-02-03',
    noun: 'You',
    article: '',
    title: 'Теперь я обращаюсь к тебе',
    quest: 'You are: обращаемся к собеседнику и различаем «я» и «ты».',
    reward: 'Адресаты проверены',
  },
  'chapter-02-02': {
    id: 'chapter-02-02',
    noun: 'lantern',
    article: 'a',
    title: 'Маленький почтовый фонарь',
    quest: 'Имя и описание: помоги Люми и Тику рассказать, кто они.',
    reward: 'Описания на бирках',
  },
  'chapter-02-01': {
    id: 'chapter-02-01',
    noun: 'Lumi',
    article: '',
    title: 'Имя на бирке',
    quest: 'Помоги Люми и Марте представиться друг другу: I am + имя.',
    reward: 'Имена на бирках',
  },
  ...closingEpisodes,
  theApple: {
    id: 'chapter-01-07',
    noun: 'apple',
    article: 'the',
    title: 'Подарок смотрителю',
    quest:
      'Кот указал на зелёное яблоко слева — подарок смотрителю первого огня. Попроси именно его для сумки Марты.',
    reward: 'Подарок в сумке',
  },
  theKey: {
    id: 'chapter-01-06',
    noun: 'key',
    article: 'the',
    title: 'Ключ от мастерской',
    quest:
      'Кот указал на средний ключ — от двери мастерской. Попроси именно его, чтобы Марта взяла его с собой.',
    reward: 'Ключ от мастерской у Марты',
  },
  cat: {
    id: 'chapter-01-01',
    noun: 'cat',
    article: 'a',
    title: 'Первая просьба',
    quest: 'Найди любую карточку с котом: собери просьбу в золотой рамке.',
    reward: 'Карточка получена',
  },
  key: {
    id: 'chapter-01-02',
    noun: 'key',
    article: 'a',
    title: 'Ключ в дорогу',
    quest:
      'Возьми один любой запасной ключ для дорожной сумки. Собери просьбу в золотой рамке.',
    reward: 'Ключ в сумке',
  },
  apple: {
    id: 'chapter-01-03',
    noun: 'apple',
    article: 'an',
    title: 'Яблоко для Марты',
    quest:
      'Возьми одно любое яблоко для Марты в дорогу. Собери an apple в золотой рамке.',
    reward: 'Яблоко в сумке',
  },
  egg: {
    id: 'chapter-01-04',
    noun: 'egg',
    article: 'an',
    title: 'Запас для привала',
    quest:
      'Положи одно любое варёное яйцо в дорожную сумку Марты. Собери просьбу в золотой рамке.',
    reward: 'Яйцо в сумке',
  },
  choiceKey: {
    id: 'chapter-01-05-key',
    noun: 'key',
    article: 'a',
    title: 'Перед дорогой · Ключ',
    quest:
      'Собери для помощника Марты один любой запасной ключ. Выбери артикль и передай просьбу в золотой рамке.',
    reward: 'Ключ для помощника',
  },
  choiceApple: {
    id: 'chapter-01-05-apple',
    noun: 'apple',
    article: 'an',
    title: 'Перед дорогой · Яблоко',
    quest:
      'Добавь в сумку помощника одно любое яблоко. Выбери артикль и передай просьбу в золотой рамке.',
    reward: 'Сумка помощника собрана',
  },
} as const;

export const theLesson = [
  {
    title: 'Последний ключ перед дорогой',
    text: 'Припасы собраны. Возьмём ключ от двери мастерской — вот он, посередине. Два других не подойдут: они от шкафа и сундука.',
  },
  {
    title: 'The — определённый артикль',
    text: 'The — определённый артикль. Его используем, когда собеседнику понятно, о каком предмете речь. Я показал ключ от двери, ты его видишь — теперь можно попросить the key. Отдельного перевода у the обычно нет.',
  },
  {
    title: 'Смысл важнее повторения',
    text: 'Раньше нам подходил любой запасной ключ: a key. Сейчас нужен ключ от двери: the key. Его можно так назвать сразу, даже если раньше о нём не говорили, — ведь я уже показал, какой нужен. Сам по себе повтор слова key ничего не меняет.',
  },
  {
    title: 'Звук и границы правила',
    text: 'A или an выбираем по следующему звуку. С the это правило не работает: пишем и the key, и the apple. Сейчас просим один предмет; в конце главы попробуем the с несколькими.',
  },
  {
    title: 'Передадим точную просьбу',
    text: 'Собери the key: the слева, key справа. Табличку a оставь за рамкой. Я положу в сумку тот ключ, на который указал. Это всё ещё словосочетание — короткая просьба, понятная нам из ситуации.',
  },
] as const;

export const theAppleIntroduction = [
  'Марта выбрала подарок смотрителю — зелёное яблоко слева. Видишь его рядом с двумя красными? Попроси именно зелёное, а остальные оставим дома.',
  'Apple — яблоко, первый звук /æ/ — гласный. Но теперь выбираем не только между a и an: на поле есть и the. Подумай, нужна просьба о любом яблоке или о том, которое я показал.',
] as const;
export const theAppleRule =
  'An apple — какое-нибудь одно яблоко. The apple — яблоко, о котором нам обоим понятно, что речь идёт именно о нём. Здесь кот показал зелёное яблоко слева, поэтому нужно the apple. Гласный звук помогает выбрать an вместо a, но не заменяет the. Цвет лишь помогает узнать подарок; правило не в том, что зелёным яблокам нужен the. A apple — ошибка формы, an apple — правильная просьба о любом яблоке вместо выбранного.';

export const choiceStories = {
  choiceKey: {
    title: 'Перед дорогой · 1 из 2',
    lines: [
      'У первого огня Марту встретит помощник. Соберём сумку и для него. Сначала возьмём запасной ключ — любой из трёх на столе.',
      'Key — ключ, первый звук /k/ — согласный. На поле есть a и an. Выбери подходящую форму; лишнюю табличку оставь за рамкой.',
    ],
    action: 'Начать просьбу',
  },
  choiceApple: {
    title: 'Перед дорогой · 2 из 2',
    lines: [
      'Ключ уже в сумке помощника. Добавим яблоко на перекус — любое из трёх.',
      'Apple — яблоко. Можно нажать на слово и послушать его. Выбери a или an по первому звуку; расположение табличек не подсказывает ответ.',
    ],
    action: 'Начать просьбу',
  },
} as const;

export const choiceRule =
  'A и an — формы неопределённого артикля. В этих просьбах нужен один любой предмет. Key начинается с согласного /k/: a key. Apple начинается с гласного /æ/: an apple. Важен звук, а не буква и не место таблички. Если нужен конкретный предмет, который собеседники могут узнать, используем the.';

export const eggIntroduction = [
  'Яблоко взяли. Добавим яйцо на привал — Марта как раз сварила три. Подойдёт любое одно. По-английски яйцо — egg.',
  'Нажми egg и послушай: /eɡ/. Первый звук /e/ — гласный. Выбери между a и an, как в просьбе с яблоком.',
  'Теперь на поле три слова: a, an и egg. Выбери подходящий артикль и собери просьбу в золотой рамке. Лишнее слово оставь за рамкой. Вспомни правило из просьбы с яблоком; объяснение и подсказка доступны в журнале.',
] as const;

export const eggRule =
  'Egg — одно яйцо, исчисляемое существительное в единственном числе. Нам подходит любое, поэтому нужен неопределённый артикль. Egg начинается с гласного /e/: an egg. Вид предмета здесь не важен. An не означает несколько: an eggs — ошибка.';

export const appleLesson = [
  {
    title: 'Яблоко для Марты',
    text: 'Ключ взяли. Теперь перекус: до первого фонаря идти далеко. На столе три яблока, возьмём одно. Яблоко по-английски — apple.',
  },
  {
    title: 'Новое слово: apple',
    text: 'Нажми apple и послушай: /ˈæp.əl/. Первый звук /æ/ — гласный. Apple называет одно яблоко; его можно посчитать. Значит, это исчисляемое существительное в единственном числе.',
  },
  {
    title: 'Та же просьба, другая форма',
    text: 'A и an — две формы одного неопределённого артикля. В обеих просьбах подходит один любой предмет. Но key начинается с согласного звука — a key, а apple с гласного — an apple.',
  },
  {
    title: 'Смотрим на звук',
    text: 'Выбираем по первому звуку следующего слова, а не по букве или виду предмета. В apple это гласный /æ/, поэтому an apple, а не a apple. Форма an не означает несколько предметов: с множественным числом apples её не ставим.',
  },
  {
    title: 'Соберём вместе',
    text: 'An уже стоит в рамке. Толкни apple вверх, на клетку справа от an, и передай просьбу. Я возьму одно яблоко со стола и положу в сумку.',
  },
] as const;

export const keyIntroduction = [
  'Следующее слово — key, ключ от замка. Послушай: /kiː/. Первый звук /k/ — согласный. Key называет один ключ.',
  'На столе три запасных ключа от дорожной сумки. Все подходят — возьмём один. Попробуй сам собрать просьбу в рамке. Если забудешь правило, загляни в журнал.',
] as const;

export const meaningChoices: {
  id: MeaningChoice;
  label: string;
  feedback: string;
}[] = [
  {
    id: 'any',
    label: 'Один любой подходящий ключ',
    feedback:
      'Верно. Мы попросили один ключ, и подошёл любой из трёх. Перед согласным /k/ в key используем a.',
  },
  {
    id: 'several',
    label: 'Несколько ключей сразу',
    feedback:
      'Вспомни: a/an используется с единственным числом. key здесь означает один ключ. Для нескольких ключей нужна другая конструкция. Попробуй ещё раз.',
  },
  {
    id: 'specific',
    label: 'Только заранее указанный ключ',
    feedback:
      'Нам подходит любой из трёх ключей, поэтому a key. Просьбу о конкретном ключе позже разберём с the.',
  },
];

export const appleChoices: typeof meaningChoices = [
  {
    id: 'fruit',
    label: 'Потому что это фрукт',
    feedback:
      'Вид предмета не определяет форму артикля. Мы смотрим на первый звук следующего слова. В apple это гласный /æ/, поэтому an. Попробуй ещё раз.',
  },
  {
    id: 'vowel',
    label: 'В apple первый звук — гласный',
    feedback:
      'Верно: apple начинается с гласного /æ/, поэтому an apple. Мы просим одно любое подходящее яблоко. a и an передают тот же смысл; форма зависит от следующего звука.',
  },
  {
    id: 'many',
    label: 'Потому что яблок несколько',
    feedback:
      'На столе их три, но в просьбе названо одно яблоко. a/an употребляется с исчисляемым существительным в единственном числе. Здесь an выбрано из-за гласного звука /æ/. Попробуй ещё раз.',
  },
];

export const eggChoices: typeof meaningChoices = [
  {
    id: 'egg-specific',
    label: 'Только заранее указанное яйцо',
    feedback:
      'Нам подходит любое яйцо из трёх. An здесь называет одно яйцо, без выбора конкретного; форма an нужна перед гласным /e/.',
  },
  {
    id: 'egg-many',
    label: 'Все три яйца для привала',
    feedback:
      'На столе три яйца, но egg в просьбе — единственное число. a/an не используется с множественным числом eggs. Мы берём только одно; an выбрано перед гласным звуком /e/. Попробуй ещё раз.',
  },
  {
    id: 'egg-any',
    label: 'Любое одно; an перед гласным звуком',
    feedback:
      'Верно: нужно одно яйцо, подходит любое. Перед гласным /e/ ставим an. С яблоком работало то же правило — дело не в том, фрукт это или нет.',
  },
];

export const reflections = {
  ...departureReflections,
  ...finaleReflections,
  ...stationNextReflections,
  'chapter-02-05': stationObjectsReflection,
  'chapter-02-04': stationThirdReflection,
  'chapter-02-03': stationAddressReflection,
  'chapter-02-02': stationIdentityReflection,
  'chapter-02-01': stationReflection,
  ...closingReflections,
  theApple: {
    choices: [
      {
        id: 'apple-always-an',
        label: 'Перед гласным всегда нужен an',
        feedback:
          'Гласный звук определяет an вместо a, когда нужен неопределённый артикль. Здесь предмет уже понятен обоим: используем the apple. Попробуй ещё раз.',
      },
      {
        id: 'apple-shared',
        label: 'Яблоко указано обоим; гласный звук не отменяет the',
        feedback:
          'Верно. Кот показал яблоко, и Люми понял, какое нужно. Поэтому the apple. Для просьбы о любом одном подошло бы an apple.',
      },
      {
        id: 'apple-repeat',
        label: 'Любое знакомое слово требует the',
        feedback:
          'Знать слово apple недостаточно: нужно понимать, какой предмет имеется в виду. Кот показал левое яблоко для смотрителя. Если бы подходило любое одно, мы попросили бы an apple. Попробуй ещё раз.',
      },
    ],
    correct: 'apple-shared',
  },
  theKey: {
    choices: [
      {
        id: 'the-repeat',
        label: 'Потому что слово key уже встречалось',
        feedback:
          'Повторения слова недостаточно: раньше мы брали другие ключи. Здесь кот явно указал на ключ от двери, и обоим понятно, какой именно нужен. Попробуй ещё раз.',
      },
      {
        id: 'the-sound',
        label: 'Потому что key начинается с согласного',
        feedback:
          'Согласный звук объясняет a вместо an, но не выбор the. The показывает, что предмет однозначно понятен собеседникам. Попробуй ещё раз.',
      },
      {
        id: 'the-shared',
        label: 'Кот и Люми понимают, какой именно ключ нужен',
        feedback:
          'Верно. Кот показал ключ от двери — Люми его узнал. Поэтому the key можно сказать сразу, даже если этот ключ ещё не обсуждали.',
      },
    ],
    correct: 'the-shared',
  },
  key: { choices: meaningChoices, correct: 'any' },
  apple: { choices: appleChoices, correct: 'vowel' },
  egg: { choices: eggChoices, correct: 'egg-any' },
  choiceKey: {
    choices: [
      {
        id: 'choice-position',
        label: 'Потому что этот блок стоял справа',
        feedback:
          'Положение таблички не определяет артикль. Вспомни звучание key и выбери объяснение ещё раз.',
      },
      {
        id: 'choice-consonant',
        label: 'Один любой ключ; key начинается с /k/',
        feedback:
          'Верно. Нужен один любой подходящий ключ. key начинается с согласного /k/, поэтому a key. В прошлой просьбе было an egg: форма меняется по звуку следующего слова.',
      },
      {
        id: 'choice-previous',
        label: 'Артикль всегда тот же, что в прошлой просьбе',
        feedback:
          'В прошлой просьбе было an egg. Сейчас слово key начинается с согласного /k/: нужна форма a. Смысл «один любой подходящий» остаётся тем же. Попробуй ещё раз.',
      },
    ],
    correct: 'choice-consonant',
  },
  choiceApple: {
    choices: [
      {
        id: 'choice-vowel',
        label: 'Один любой плод; apple начинается с /æ/',
        feedback:
          'Верно. Мы просим одно любое яблоко. Перед гласным /æ/ в apple выбираем an, а перед согласным /k/ в key — a. Это две формы одного неопределённого артикля.',
      },
      {
        id: 'choice-previous',
        label: 'Нужна a, как в просьбе с ключом',
        feedback:
          'Смысл просьбы остался прежним, но начальный звук изменился: apple начинается с гласного /æ/. Поэтому an apple. Попробуй ещё раз.',
      },
      {
        id: 'choice-position',
        label: 'Правильная табличка всегда слева',
        feedback:
          'В другой комнате она может оказаться справа. Выбираем по первому звуку следующего слова; у apple это гласный /æ/. Попробуй ещё раз.',
      },
    ],
    correct: 'choice-vowel',
  },
} as const;
