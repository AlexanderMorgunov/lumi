import type { EpisodeId } from './episodes';

export const chapterTwoStops: readonly {
  ids: readonly EpisodeId[];
  title: string;
  topic: string;
}[] = [
  {
    ids: ['chapter-02-01'],
    title: 'Имя на бирке',
    topic: 'Личное местоимение I · форма am · имя говорящего',
  },
  {
    ids: ['chapter-02-02'],
    title: 'Маленький почтовый фонарь',
    topic: 'Имя и описание · I am a lantern / I am a robot',
  },
  {
    ids: ['chapter-02-03'],
    title: 'Теперь я обращаюсь к тебе',
    topic: 'Личное местоимение you · форма are · один собеседник',
  },
  {
    ids: ['chapter-02-04'],
    title: 'О ком мы говорим',
    topic: 'He / she · форма is · говорим о другом герое',
  },
  {
    ids: ['chapter-02-05'],
    title: 'Кто потерял зонт',
    topic: 'It is · обычный предмет · an umbrella / an egg',
  },
  {
    ids: ['chapter-02-06'],
    title: 'То же сообщение короче',
    topic: 'I’m / you’re / he’s / she’s / it’s · полная и короткая формы',
  },
  {
    ids: ['chapter-02-07'],
    title: 'Бирки поменялись местами',
    topic: 'Самостоятельное повторение · кто говорит, кому и о чём',
  },
  {
    ids: ['chapter-02-08'],
    title: 'Один робот, два робота',
    topic:
      'Единственное и множественное число · -s · two robots / books / keys',
  },
  {
    ids: ['chapter-02-09'],
    title: 'Ящики с историями',
    topic: 'Написание множественного числа · boxes / stories / keys',
  },
  {
    ids: ['chapter-02-10'],
    title: 'Не каждое слово получает s',
    topic: 'Особые формы · child / children · person / people',
  },
  {
    ids: ['chapter-02-11'],
    title: 'Мы, вы и они',
    topic: 'We / they / you для группы · are · ready · we’re / they’re',
  },
  {
    ids: ['chapter-02-12'],
    title: 'Список пассажиров',
    topic: 'Роль и число · the robot is / the robots are · повторение форм',
  },
  {
    ids: ['chapter-02-13'],
    title: 'Ещё не готовы',
    topic: 'Not после be · isn’t / aren’t · сообщение по фактам',
  },
  {
    ids: ['chapter-02-14'],
    title: 'Спросить перед отправлением',
    topic: 'Общий вопрос · Are you ready? / Is she ready? / Are they ready?',
  },
  {
    ids: ['chapter-02-15'],
    title: 'Да, я готов',
    topic: 'Положительный короткий ответ · Yes, I am / we are / he is',
  },
  {
    ids: ['chapter-02-16'],
    title: 'Нет, пока не готовы',
    topic: 'No · отрицательные короткие ответы · сокращения',
  },
  {
    ids: ['chapter-02-17'],
    title: 'Кто здесь и что в ящике',
    topic: 'Who / what · вопросы и ответы о человеке и предмете',
  },
  {
    ids: ['chapter-02-18'],
    title: 'Где попутчик',
    topic: 'Where · here · at the station',
  },
  {
    ids: ['chapter-02-19'],
    title: 'Сколько тебе лет',
    topic: 'How old · возраст с be · eight / six · years old',
  },
  {
    ids: ['chapter-02-20'],
    title: 'Перекличка перед дорогой',
    topic: 'Самостоятельное повторение · участники, вопросы и ответы',
  },
];

export const chapterOneStops: readonly {
  ids: readonly EpisodeId[];
  title: string;
  topic: string;
}[] = [
  { ids: ['cat'], title: 'Первая просьба', topic: 'Что такое артикль · a cat' },
  { ids: ['key'], title: 'Ключ в дорогу', topic: 'Один любой предмет · a key' },
  {
    ids: ['apple'],
    title: 'Яблоко для Марты',
    topic: 'Гласный звук · an apple',
  },
  {
    ids: ['egg'],
    title: 'Запас для привала',
    topic: 'Выбор a/an · новое слово egg',
  },
  {
    ids: ['choiceKey', 'choiceApple'],
    title: 'Перед дорогой',
    topic: 'Согласный и гласный · две просьбы',
  },
  {
    ids: ['theKey'],
    title: 'Ключ от мастерской',
    topic: 'Определённый артикль · the key',
  },
  {
    ids: ['theApple'],
    title: 'Подарок смотрителю',
    topic: 'The перед гласным · the apple',
  },
  {
    ids: ['keyChain'],
    title: 'Ключ, который мы выбрали',
    topic: 'Общий выбор · a key → the key',
  },
  {
    ids: ['appleChain'],
    title: 'Яблоко, которое мы отложили',
    topic: 'Тот же предмет · an apple → the apple',
  },
  {
    ids: ['mixedRequests'],
    title: 'Список перед дорогой',
    topic: 'A/an/the по ситуации · book, orange, key',
  },
  {
    ids: ['newWords'],
    title: 'Помощник и зонт',
    topic: 'Перенос на robot и umbrella',
  },
  {
    ids: ['chapterFinale'],
    title: 'Дорога огней ждёт',
    topic: 'Apples / the apples · множественное число и итог',
  },
];
export const journeyChapters = [
  {
    title: 'Мастерская у леса',
    topic: 'Артикли a / an / the',
    description:
      'Один любой предмет или тот, который понятен обоим. Собираем Люми в дорогу.',
    available: true,
  },
  {
    title: 'Станция встреч',
    topic: 'To be · am / is / are',
    description: 'Знакомимся с жителями и учимся строить первые предложения.',
    available: false,
  },
  {
    title: 'Сады указателей',
    topic: 'Принадлежность · my / your · have / has',
    description: 'Помогаем вернуть потерянные вещи их владельцам.',
    available: false,
  },
  {
    title: 'Мельница над ручьём',
    topic: 'In / on / under',
    description: 'Описываем, где находятся вещи.',
    available: false,
  },
  {
    title: 'Тихая гавань',
    topic: 'Can · способности',
    description: 'Узнаём, кто может помочь с переправой.',
    available: false,
  },
  {
    title: 'Город часов',
    topic: 'Present Simple',
    description: 'Обсуждаем привычки и расписание.',
    available: false,
  },
  {
    title: 'Оранжерея дождя',
    topic: 'Present Continuous',
    description: 'Рассказываем, что происходит сейчас.',
    available: false,
  },
  {
    title: 'Архив затихших огней',
    topic: 'Was / were · Past Simple',
    description: 'Восстанавливаем события прошлого.',
    available: false,
  },
  {
    title: 'Большой маяк',
    topic: 'Повторение изученного',
    description: 'Соединяем огни долины знакомыми конструкциями.',
    available: false,
  },
] as const;
export function stopStatus(
  stop: (typeof chapterOneStops)[number],
  unlocked: readonly EpisodeId[],
  completed: readonly EpisodeId[],
) {
  return stop.ids.every((id) => completed.includes(id))
    ? 'completed'
    : stop.ids.some((id) => unlocked.includes(id))
      ? 'available'
      : 'locked';
}
