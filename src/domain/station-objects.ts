import type { LevelDefinition, Piece, ReferenceObject } from './levels';
import { stationPeople } from './station-chapter';
export const stationObjectsEpisode = 'chapter-02-05' as const;
export const stationObjectsRule =
  'It — личное местоимение. Здесь оно обозначает один обычный предмет, о котором говорят и который можно узнать по указателю: сначала зонт, потом яйцо на рисунке. С it нужна форма is глагола be: It is an umbrella — «Это зонт»; It is an egg — «Это яйцо». В этой конструкции is не пропускаем. Перевод it зависит от фразы: по-русски возможны «он», «она», «оно», «это». Это не слово this, которое разберём отдельно. Род русского слова не определяет английское местоимение: обычный зонт не становится he из-за русского «он». Мы не переносим это правило на всех животных и одушевлённых героев вроде Тика. Umbrella и egg начинаются с гласных звуков, поэтому перед названием одного предмета нужна форма an, не a. Указатель помогает понять, к чему относится it; он не требует автоматически the. Сейчас называем вид предмета, поэтому an umbrella / an egg. The возможно, когда нужно уточнить, какой именно это зонт или какое яйцо; здесь такой задачи нет. На карточке описываем изображённое яйцо, а не бумагу. Слова записывают описание и не превращают предметы.';
const tile = (word: string, x: number, y: number): Piece => ({
  id: word,
  kind: 'word',
  word,
  x,
  y,
});
const objects: readonly ReferenceObject[] = [
  { id: 'station-lost-umbrella', noun: 'umbrella', label: 'зонт у стойки' },
  {
    id: 'station-egg-picture',
    noun: 'egg',
    label: 'яйцо на рисунке',
    display: 'card',
  },
];
const nouns = ['umbrella', 'egg'];
const pronouns = ['It', 'He', 'She'];
const board = {
  revision: 1,
  columns: 8,
  rows: 5,
  walls: [],
  slots: [
    { x: 2, y: 1 },
    { x: 3, y: 1 },
    { x: 4, y: 1 },
    { x: 5, y: 1 },
  ],
  answers: pronouns.flatMap((pronoun) =>
    nouns.flatMap((noun) => [
      {
        words: [pronoun, 'is', 'an', noun],
        goal: true,
        effect: { type: 'record-message' as const },
      },
      {
        words: [pronoun, 'is', 'the', noun],
        goal: false,
        feedback:
          'Предложение с the возможно, если нужно уточнить, какой именно это предмет. Сейчас называем, что перед нами: один зонт или одно яйцо. Указатель определяет предмет для it, а в описании его вида нужна форма an.',
      },
    ]),
  ),
  mistakes: pronouns.flatMap((pronoun) =>
    nouns.flatMap((noun) => [
      {
        words: [pronoun, 'is', 'a', noun],
        reason: 'article' as const,
        feedback: `${noun} начинается с гласного звука, поэтому нужна форма an. Местоимение и смысл сообщения проверим после исправления артикля.`,
      },
      ...['a', 'an', 'the'].map((article) => ({
        words: [pronoun, 'are', article, noun],
        reason: 'agreement' as const,
        feedback:
          'С it, he и she нужна форма is. Are здесь не подходит. Сначала исправь форму глагола, затем проверь, о чём сообщение.',
      })),
    ]),
  ),
};
const eggPicture: LevelDefinition = {
  ...board,
  id: 'chapter-02-05-egg',
  message: {
    speaker: 'marta',
    recipient: 'tik',
    intent: 'describe-object',
    people: stationPeople,
  },
  reference: {
    objects,
    indicatedId: 'station-egg-picture',
    markerLabel: 'Предмет на рисунке',
  },
  start: { x: 5, y: 3 },
  pieces: [
    tile('It', 2, 2),
    tile('is', 3, 2),
    tile('an', 4, 3),
    tile('egg', 5, 2),
    tile('umbrella', 6, 3),
    tile('a', 1, 2),
    tile('the', 1, 3),
    tile('He', 0, 2),
    tile('She', 0, 3),
    tile('are', 6, 2),
  ],
  presentation: {
    title: 'Что нарисовано на карточке',
    noun: 'egg',
    quest:
      'Марта сообщает Тику, что изображено под указателем: «Это яйцо». Опиши нарисованный предмет, а не саму карточку.',
    introduction: [
      'Рядом лежит карточка с рисунком. Я расскажу Тику, что на ней изображено. Видишь яйцо под указателем? По-английски яйцо — egg. Люми, помоги мне составить сообщение.',
      'Собери моё сообщение: «Это яйцо». Мы описываем яйцо на рисунке, а не бумажную карточку. Подбери местоимение, форму глагола, артикль и название предмета.',
    ],
    success: [
      'It is an egg. Это яйцо. Верно: мы назвали то, что изображено на карточке. Зонт остался на своём месте, рисунок тоже не изменился.',
      'Сначала речь шла о зонте, потом — о яйце на рисунке. Почему в обоих сообщениях подошло it?',
    ],
    speakers: { task: ['marta', 'marta'], success: ['marta', 'tik'] },
    rule: stationObjectsRule,
    hint: 'Марта говорит Тику о яйце на рисунке: It is an egg. Из начала этой части: ↑ ↓ ↓ ← ↑ ↑ ↓ ← ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationObjectsLevel: LevelDefinition = {
  ...board,
  id: stationObjectsEpisode,
  continuation: eggPicture,
  message: {
    speaker: 'tik',
    recipient: 'lumi',
    intent: 'describe-object',
    people: stationPeople,
  },
  reference: {
    objects,
    indicatedId: 'station-lost-umbrella',
    markerLabel: 'Находка у стойки',
  },
  start: { x: 5, y: 3 },
  pieces: [
    tile('It', 2, 1),
    tile('is', 3, 1),
    tile('an', 4, 2),
    tile('umbrella', 5, 2),
    tile('egg', 6, 3),
    tile('a', 1, 2),
    tile('the', 1, 3),
    tile('He', 0, 2),
    tile('She', 0, 3),
    tile('are', 6, 2),
  ],
  presentation: {
    title: 'Кто потерял зонт',
    noun: 'umbrella',
    quest:
      'Тик сообщает Люми о находке под указателем: «Это зонт». Назови вид найденного предмета.',
    introduction: [
      'Кто-то оставил зонт у стойки. Хозяин пока не вернулся — запишем находку. Я говорю тебе, Люми, об обычном зонте под указателем.',
      'It — личное местоимение. Здесь оно обозначает один обычный предмет, о котором мы говорим. Должно быть понятно, какой именно: сейчас я показал зонт.',
      'С этим местоимением нужна форма is. It is an umbrella — «Это зонт». В этой фразе мы сообщаем, что перед нами за предмет.',
      'Umbrella начинается с гласного звука, поэтому an umbrella. Указатель помогает понять, о чём речь, но не отменяет an, когда мы называем вид предмета.',
      'По-русски зонт — «он», но здесь не нужен he: перед нами обычная вещь, не живой герой. Соберём It is an umbrella. Первые два слова уже в рамке.',
    ],
    success: [
      'It is an umbrella. Это зонт. Описание находки записано; сам зонт никуда не исчез и не превратился в другой предмет.',
      'Теперь Марта проверит рисунок на соседней карточке. Посмотри, куда переместится указатель.',
    ],
    speakers: {
      task: ['tik', 'tik', 'tik', 'tik', 'tik'],
      success: ['tik', 'tik'],
    },
    rule: stationObjectsRule,
    hint: 'Тик описывает обычный зонт: It is an umbrella. Из начала эпизода: ↑ ↓ ← ↑. Затем передай сообщение.',
    destination: 'register',
  },
};
export const stationObjectsReflection = {
  correct: 'object-ordinary' as const,
  choices: [
    {
      id: 'object-ordinary' as const,
      label: 'Речь об обычных предметах; понятно, о каком именно',
      feedback:
        'Верно. Мы описывали обычный зонт и яйцо на рисунке. В каждом сообщении it относилось к понятному нам предмету, а не к говорящему или слушателю.',
    },
    {
      id: 'object-russian' as const,
      label: 'It выбирают только для русского среднего рода',
      feedback:
        'Нет. По-русски зонт — «он», а яйцо — «оно». Но в этих английских сообщениях оба предмета обозначаем it. Род русского слова не определяет выбор.',
    },
    {
      id: 'object-listener' as const,
      label: 'It обозначает того, кто слушает',
      feedback:
        'Собеседника обозначает you. Здесь it относилось к предмету под указателем: сначала к зонту, затем к яйцу на рисунке.',
    },
  ],
};
