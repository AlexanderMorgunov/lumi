import type { LevelDefinition, Piece } from './levels';
import { stationPeople } from './station-chapter';

export const stationIdentityEpisode = 'chapter-02-02' as const;
export const stationIdentityRule =
  'Lumi — имя, а lantern — «фонарь», исчисляемое существительное. I am Lumi называет имя; I am a lantern сообщает, кто я: один из фонарей. В такой фразе перед названием одного предмета используем неопределённый артикль a/an. Lantern и robot начинаются с согласных звуков, поэтому a lantern, a robot. Знакомы ли мы собеседнику, здесь не важно: мы называем вид, а не выделяем конкретного участника. I am the lantern возможно, если нужно узнать определённый фонарь, например того, кто принёс письмо; сейчас такой задачи нет. Перед именами Lumi и Tik в обычном представлении артикль не ставим. С I по-прежнему нужна форма am. I означает автора сообщения: сначала Люми, затем Тика. Слова сообщают, кто герой, а не превращают его в другой предмет.';

const tile = (word: string, x: number, y: number): Piece => ({
  id: word,
  kind: 'word',
  word,
  x,
  y,
});
const nouns = ['lantern', 'robot'] as const;
const answers: LevelDefinition['answers'] = nouns.flatMap((noun) => [
  {
    words: ['I', 'am', 'a', noun],
    goal: true,
    effect: { type: 'record-message' },
  },
  {
    words: ['I', 'am', 'the', noun],
    goal: false,
    feedback:
      'Предложение с the возможно, когда нужно указать, какой именно это фонарь или робот. Сейчас задача другая: назвать, к какому виду относится говорящий. Для этого используем a перед lantern или robot.',
  },
]);
const mistakes: LevelDefinition['mistakes'] = nouns.flatMap((noun) => [
  {
    words: ['I', 'am', 'an', noun],
    reason: 'article',
    feedback: `${noun} начинается с согласного звука. Здесь нужна форма a, не an. Смысл сообщения пока не меняем.`,
  },
  ...['a', 'an', 'the'].map((article) => ({
    words: ['I', 'is', article, noun],
    reason: 'agreement' as const,
    feedback:
      'О себе говорим I am. С I форма is не подходит. Сначала замени форму be, затем проверь остальные слова.',
  })),
]);
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
  answers,
  mistakes,
};
const tikDescription: LevelDefinition = {
  ...board,
  id: 'chapter-02-02-tik',
  message: {
    speaker: 'tik',
    recipient: 'marta',
    intent: 'describe-self',
    people: stationPeople,
  },
  start: { x: 5, y: 3 },
  pieces: [
    tile('I', 2, 2),
    tile('am', 3, 2),
    tile('a', 4, 3),
    tile('robot', 5, 2),
    tile('lantern', 6, 3),
    tile('an', 1, 2),
    tile('the', 1, 3),
    tile('is', 6, 2),
  ],
  presentation: {
    title: 'Теперь о себе говорит Тик',
    noun: 'robot',
    quest:
      'Тик говорит Марте: «Я робот». Собери его сообщение о том, кто он, без имени.',
    introduction: [
      'Мою бирку тоже дополним. Я Тик, почтовый робот. Слово robot тебе уже знакомо: оно значит «робот».',
      'Теперь я говорю Марте о себе. Помоги мне составить сообщение «Я робот». Имя уже записано; сейчас назовём, кто я. Ты двигаешь слова, а I в этом сообщении означает меня.',
    ],
    success: [
      'I am a robot. Я робот. Теперь на моей бирке есть и имя, и описание. Можно разносить письма!',
      'На бирках стоят Lumi и Tik. А в описаниях появились a lantern и a robot. Почему перед lantern и robot нужен a, а перед нашими именами его нет?',
    ],
    speakers: { task: ['tik', 'tik'], success: ['tik', 'tik'] },
    rule: stationIdentityRule,
    hint: 'Говорит Тик: I am a robot. Из начала этой части: ↑ ↓ ↓ ← ↑ ↑ ↓ ← ↑ ↓ ← ↑. Затем передай сообщение. Лишние слова оставь вне рамки.',
    destination: 'register',
  },
};
export const stationIdentityLevel: LevelDefinition = {
  ...board,
  id: stationIdentityEpisode,
  continuation: tikDescription,
  message: {
    speaker: 'lumi',
    recipient: 'marta',
    intent: 'describe-self',
    people: stationPeople,
  },
  start: { x: 5, y: 3 },
  pieces: [
    tile('I', 2, 1),
    tile('am', 3, 1),
    tile('a', 4, 2),
    tile('lantern', 5, 2),
    tile('robot', 6, 3),
    tile('an', 1, 2),
    tile('the', 1, 3),
    tile('is', 6, 2),
  ],
  presentation: {
    title: 'Маленький почтовый фонарь',
    noun: 'lantern',
    quest:
      'Люми говорит Марте: «Я фонарь». Дополни I am словами, которые описывают героя.',
    introduction: [
      'Имена на месте. Добавим к биркам короткие описания. Люми, ты живой фонарь. По-английски фонарь — lantern. Так называют и тебя, и обычный фонарь под крышей.',
      'Lumi — твоё имя, а lantern — название предмета. Сравни: I am Lumi — «Я Люми». I am a lantern — «Я фонарь».',
      'Lantern можно посчитать: один фонарь, два фонаря. Когда говорим, что ты один из фонарей, перед этим словом нужен неопределённый артикль. Здесь a: lantern начинается с согласного звука.',
      'Я давно тебя знаю, но в описании всё равно будет a lantern. Мы говорим, кто ты, а не выбираем, какой именно фонарь нужен. Ты остаёшься Люми — слова никого не превращают.',
      'Попробуем вместе: собери I am a lantern. Первые два слова уже в рамке. Потом ты поможешь Тику составить такое сообщение самому.',
    ],
    success: [
      'Верно: I am a lantern — «Я фонарь». Имя Люми осталось прежним. Теперь рядом с ним есть описание.',
      'Люми рассказал о себе. Теперь передадим слово Тику — его бирке тоже нужно описание.',
    ],
    speakers: {
      task: ['marta', 'marta', 'marta', 'marta', 'marta'],
      success: ['marta', 'marta'],
    },
    rule: stationIdentityRule,
    hint: 'Нужно I am a lantern. Из начала эпизода: ↑ ↓ ← ↑. Затем передай сообщение. Кнопка отмены позволяет вернуть любой ход.',
    destination: 'register',
  },
};
export const stationIdentityReflection = {
  correct: 'identity-kind' as const,
  choices: [
    {
      id: 'identity-kind' as const,
      label: 'Это названия одного предмета, а Lumi и Tik — имена',
      feedback:
        'Да. В описании называем вид: один фонарь или один робот. Поэтому a lantern и a robot. В обычном представлении перед именем артикль не нужен.',
    },
    {
      id: 'identity-stranger' as const,
      label: 'Марта ещё не знакома с Люми и Тиком',
      feedback:
        'Марта уже знает обоих. Здесь a помогает назвать вид: фонарь или робот. Знакомство с собеседником не отменяет артикль в таком описании.',
    },
    {
      id: 'identity-after-am' as const,
      label: 'После am всегда нужно a',
      feedback:
        'Не всегда. В I am Lumi после am стоит имя без артикля. В I am a lantern слово lantern называет один предмет — здесь нужен a.',
    },
  ],
};
