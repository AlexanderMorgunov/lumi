import type { LevelDefinition } from './levels';
import { stationLesson, group, type StationLesson } from './station-next';
import type { ExchangeContext, Member } from './station-exchange';
import type { ParticipantId } from './station-chapter';

export const departureEpisodes = {
  'chapter-02-11': {
    id: 'chapter-02-11',
    noun: 'We',
    article: '',
    title: 'Мы, вы и они',
    quest: 'Кто входит в группу и кто говорит от её имени?',
    reward: 'Группы объявлены',
  },
  'chapter-02-12': {
    id: 'chapter-02-12',
    noun: 'They',
    article: '',
    title: 'Список пассажиров',
    quest: 'Помоги заполнить список пассажиров: выбери местоимения и формы be.',
    reward: 'Список проверен',
  },
  'chapter-02-13': {
    id: 'chapter-02-13',
    noun: 'not',
    article: '',
    title: 'Ещё не готовы',
    quest: 'Помоги героям сказать, готовы ли они к дороге.',
    reward: 'Сборы проверены',
  },
  'chapter-02-14': {
    id: 'chapter-02-14',
    noun: 'ready',
    article: '',
    title: 'Спросить перед отправлением',
    quest: 'Спроси героев, готовы ли они отправляться.',
    reward: 'Ответы получены',
  },
  'chapter-02-15': {
    id: 'chapter-02-15',
    noun: 'Yes',
    article: '',
    title: 'Да, я готов',
    quest: 'Ответь коротко, учитывая, кто теперь говорит.',
    reward: 'Ответы записаны',
  },
} as const;
type DepartureEpisode = keyof typeof departureEpisodes;
const pair: readonly Member[] = ['lumi', 'tik'];
const porters: readonly Member[] = ['porter-a', 'porter-b'];
const tikPair: readonly Member[] = ['tik', 'porter-a'];

const groupsRule =
  'We — «мы»: говорящий и ещё кто-то. They — «они»: другая группа, о которой говорят. You может означать и «ты», и «вы». Посмотри в задании, к кому обращается герой: к одному собеседнику или к нескольким. С we, they и you используем are. Ready — прилагательное «готов / готова / готовы». Прилагательное описывает состояние, не называет предмет; ready не получает -s во множественном числе. We are ready — «Мы готовы». We’re = we are; they’re = they are. Полная и сокращённая формы равноправны. We are robots — «Мы роботы»: robots — существительное во множественном числе, без a/an. Выбор we или they зависит от того, кто говорит. We включает говорящего, they — нет.';
const numberRule =
  groupsRule +
  ' Подлежащее может быть не местоимением, а названием: The robot is ready — «Этот робот готов»; The robots are ready — «Эти роботы готовы». Один робот — is, несколько — are. The означает, что участникам понятно, о каком роботе или какой группе речь: это задаёт указатель. The возможно в обоих числах; ограничение одного предмета относится к a/an. Подписи two boxes и two children не являются предложениями, be в них не нужен.';
const negativeRule =
  'Отрицание сообщает, что что-то не так: not означает «не» и ставится после be. I am not ready — «Я не готов». I’m not ready — то же самое. They are not ready = They’re not ready = They aren’t ready. He is not ready = He’s not ready = He isn’t ready. В aren’t и isn’t сокращено not; в they’re и he’s сокращён be. Эти способы равноправны. С I am not используем I’m not, но не amn’t. В этих заданиях герой готов к дороге, когда его багаж собран. Если багаж уже собран, нужно положительное сообщение, без not. Ready не меняет написания при разном числе.';
const questionRule =
  'Общий вопрос — вопрос, на который можно ответить «да» или «нет». В нейтральном вопросе с be ставим am/is/are перед подлежащим: You are ready → Are you ready? She is ready → Is she ready? They are ready → Are they ready? Подлежащее — тот, о ком спрашиваем. Говорящий пока не знает, готов ли собеседник. Он узнает это из ответа. Ответ «нет» тоже подходит: цель — узнать, как идут сборы. You are ready? бывает переспросом в речи, но здесь тренируем нейтральный вопрос с перестановкой. Вопросительный знак добавляется к записи автоматически, отдельную плитку для него двигать не нужно.';
const answerRule =
  'Yes значит «да». Положительный короткий ответ с be: Yes + личное местоимение + am/is/are. Марта спрашивает Люми Are you ready? В её вопросе you — Люми; отвечая о себе, Люми говорит Yes, I am. За свою группу: Yes, we are. О Тике: Yes, he is. В коротком положительном ответе be не сокращаем: Yes, I am, а не Yes, I’m. Полный ответ Yes, I am ready и его сокращение Yes, I’m ready правильны, но здесь требуется именно короткий ответ, без повторения ready. Ответ должен совпадать с фактами. Отрицательные короткие ответы разберём в следующем эпизоде.';

type ExchangeLesson = {
  suffix: string;
  words: readonly string[];
  alternatives: readonly (readonly string[])[];
  shortcuts?: readonly string[];
  speaker: ParticipantId;
  recipient: ParticipantId;
  focus: readonly Member[];
  label: string;
  audience?: readonly Member[];
  audienceLabel?: string;
  selfGroup?: readonly Member[];
  thirdGroup?: readonly Member[];
  act?: ExchangeContext['act'];
  predicate?: ExchangeContext['predicate'];
  ready?: boolean;
  evidence: string;
  baggage?: 'bag' | 'crate';
  question?: string;
  quest?: string;
  introduction: readonly string[];
  success: string;
  rule: string;
  independent?: boolean;
};
function exchange(data: ExchangeLesson): StationLesson {
  const context: ExchangeContext = {
    act: data.act ?? 'statement',
    focus: data.focus,
    focusLabel: data.label,
    addressees: data.audience ?? [data.recipient],
    audienceLabel:
      data.audienceLabel ??
      { lumi: 'Люми', marta: 'Марта', tik: 'Тик' }[data.recipient],
    selfGroup:
      data.selfGroup ??
      (data.speaker === 'tik' ? tikPair : [data.speaker, 'tik']),
    thirdGroup: data.thirdGroup ?? porters,
    predicate: data.predicate ?? 'ready',
    ready: data.ready ?? true,
    evidence: data.evidence,
    question: data.question,
  };
  const extraRobots = data.focus.filter((id) =>
    id.startsWith('porter-'),
  ).length;
  const objects: NonNullable<LevelDefinition['reference']>['objects'] = [
    ...(extraRobots
      ? [
          {
            id: `${data.suffix}-robots`,
            noun: extraRobots === 2 ? 'robots' : 'robot',
            label: extraRobots === 2 ? 'два робота у стойки' : 'робот у стойки',
            ...(extraRobots === 2 ? { count: 2 as const } : {}),
          },
        ]
      : []),
    {
      id: 'departure-baggage',
      noun: 'bag',
      illustration: data.baggage ?? 'bag',
      label: 'статус багажа',
      display: 'record',
      caption:
        context.act === 'question'
          ? 'Ожидаем\nответа'
          : context.ready
            ? 'Багаж\nсобран'
            : 'Багаж\nне собран',
    },
  ];
  const patterns = [data.words, ...data.alternatives];
  return {
    suffix: data.suffix,
    words: data.words,
    alternatives: data.alternatives,
    distractors: data.shortcuts,
    frameLength: Math.max(...patterns.map((p) => p.length)),
    wide: new Set([...patterns.flat(), ...(data.shortcuts ?? [])]).size > 7,
    independent: data.independent,
    message: {
      speaker: data.speaker,
      recipient: data.recipient,
      intent: 'exchange',
      exchange: context,
    },
    reference: {
      objects,
      indicatedId: extraRobots ? objects[0]!.id : 'departure-baggage',
      markerLabel: extraRobots ? 'Роботы у стойки' : 'Багаж',
    },
    quest:
      data.quest ??
      `О ком нужно рассказать: ${data.label}. Используй ${data.words[0] === 'the' ? 'название с the' : 'местоимение'}. Посмотри на запись: ${data.evidence}.`,
    introduction: data.introduction,
    success: data.success,
    rule: data.rule,
    hint: `Посмотри вверху экрана, кто говорит, о ком и что уже известно. Подходящая запись: ${data.words.join(' ')}. Поставь слова подряд; свободные клетки можно оставить с любого края рамки.`,
  };
}
function chain(
  id: DepartureEpisode,
  parts: readonly StationLesson[],
  question: string,
): LevelDefinition {
  let next: LevelDefinition | undefined;
  for (let i = parts.length - 1; i >= 0; i--) {
    const data = parts[i]!;
    const level = stationLesson(
      i === 0 ? id : `${id}-${data.suffix}`,
      departureEpisodes[id].title,
      data,
    );
    if (next) level.continuation = next;
    else
      level.presentation = {
        ...level.presentation!,
        success: [data.success, question],
        speakers: {
          ...level.presentation!.speakers!,
          success: [data.message.speaker, data.message.speaker],
        },
      };
    next = level;
  }
  return next!;
}

const groups = chain(
  'chapter-02-11',
  [
    exchange({
      suffix: 'we',
      words: ['We', 'are', 'ready'],
      alternatives: [['You', 'are', 'ready']],
      shortcuts: ["We're", "You're"],
      speaker: 'lumi',
      recipient: 'marta',
      focus: pair,
      label: 'Люми и Тик',
      selfGroup: pair,
      evidence: 'сумки Люми и Тика собраны',
      quest:
        'Люми сообщает Марте о себе и Тике. Используй местоимение для своей группы.',
      introduction: [
        'Мы с Тиком собрали сумки, Марта. Ready означает «готов / готова / готовы». Это прилагательное: оно описывает состояние и пишется одинаково для одного и для нескольких.',
        'О себе вместе с кем-то говорим we — «мы». С we нужна форма are: We are ready — «Мы готовы». В эту группу вхожу и я.',
        'Можно короче: We’re ready. We’re заменяет we are, как I’m заменяет I am. Выбери полную или сокращённую запись.',
      ],
      success:
        'We are ready — «Мы готовы». Я говорю о нас с Тиком, поэтому выбираю we. Наши сумки уже собраны.',
      rule: groupsRule,
    }),
    exchange({
      suffix: 'you',
      words: ['You', 'are', 'ready'],
      alternatives: [['We', 'are', 'ready']],
      shortcuts: ["You're", "We're"],
      speaker: 'marta',
      recipient: 'lumi',
      audience: pair,
      audienceLabel: 'Люми и Тик',
      focus: pair,
      label: 'Люми и Тик',
      evidence: 'обе дорожные сумки собраны',
      quest: 'Марта обращается одновременно к Люми и Тику. Скажи: «Вы готовы».',
      introduction: [
        'Люми, Тик, я обращаюсь к вам обоим. You может означать не только «ты», но и «вы». Форма остаётся are.',
        'You are ready — «Вы готовы». Ready не получает -s: это состояние, а не название нескольких предметов.',
      ],
      success:
        'You are ready — «Вы готовы». Теперь я обращаюсь к вам обоим, Люми и Тик. Поэтому говорю you.',
      rule: groupsRule,
    }),
    exchange({
      suffix: 'they',
      words: ['They', 'are', 'ready'],
      alternatives: [
        ['We', 'are', 'ready'],
        ['You', 'are', 'ready'],
      ],
      shortcuts: ["They're", "We're", "You're"],
      speaker: 'marta',
      recipient: 'lumi',
      focus: porters,
      label: 'два робота у стойки',
      evidence: 'багаж обоих роботов закреплён',
      quest:
        'Марта сообщает Люми о двух других роботах у стойки. Используй местоимение.',
      introduction: [
        'Посмотри на двух роботов у стойки, Люми. Они тоже закрепили багаж. Я говорю о другой группе — не о себе и не о тебе.',
        'They — «они». С they используем are: They are ready — «Они готовы». Короткая запись — They’re ready.',
      ],
      success:
        'They are ready — «Они готовы». Я рассказываю тебе о роботах у стойки. Ни ты, ни я в эту группу не входим.',
      rule: groupsRule,
    }),
    exchange({
      suffix: 'robots',
      words: ['We', 'are', 'robots'],
      alternatives: [
        ['They', 'are', 'robots'],
        ['You', 'are', 'robots'],
      ],
      shortcuts: ["We're", "They're", "You're"],
      speaker: 'tik',
      recipient: 'marta',
      focus: tikPair,
      label: 'Тик и робот у стойки',
      predicate: 'robots',
      evidence: 'Тик и его напарник — два робота',
      independent: true,
      introduction: [
        'Марта, этот робот поможет мне с почтой. Теперь я говорю о нас двоих и называю, кто мы.',
        'Подбери местоимение для нас двоих. Robots уже во множественном числе; a/an перед ним не нужны.',
      ],
      success:
        'We are robots — «Мы роботы». Я тоже робот, поэтому говорю we. В слове robots нужен -s: нас двое.',
      rule: groupsRule,
    }),
  ],
  'Что отличает we от they, если участников по-прежнему двое?',
);

const labelsRule =
  'Two boxes — два ящика: после x добавляем -es. Two children — два ребёнка: child → children, особая форма. Это подписи количества и вида, не предложения с be. Не добавляй a/an к множественному числу. Проверь указатель: правильная форма подписи ещё должна подходить выбранной записи.';
const boxPair = {
  singular: 'box',
  plural: 'boxes',
  one: 'один ящик',
  two: 'два ящика',
  record: true,
};
const childPair = {
  singular: 'child',
  plural: 'children',
  one: 'один ребёнок',
  two: 'два ребёнка',
  record: true,
};
const passengerList = chain(
  'chapter-02-12',
  [
    exchange({
      suffix: 'they',
      words: ['They', 'are', 'robots'],
      alternatives: [
        ['We', 'are', 'robots'],
        ['You', 'are', 'robots'],
      ],
      shortcuts: ["They're", "We're", "You're"],
      speaker: 'marta',
      recipient: 'lumi',
      focus: tikPair,
      thirdGroup: tikPair,
      label: 'Тик и робот у стойки',
      predicate: 'robots',
      evidence: 'в паре два робота',
      independent: true,
      introduction: [
        'Проверим одну пару в списке: Тика и робота у стойки. Сейчас я рассказываю о них Люми.',
        'Дальше об этой паре поговорим по очереди. Сначала помоги мне сказать Люми, кто они.',
      ],
      success:
        'They are robots — «Они роботы». Я говорю тебе о Тике и его напарнике, Люми. Поэтому выбираю they.',
      rule: numberRule,
    }),
    exchange({
      suffix: 'we',
      words: ['We', 'are', 'robots'],
      alternatives: [
        ['They', 'are', 'robots'],
        ['You', 'are', 'robots'],
      ],
      shortcuts: ["We're", "They're", "You're"],
      speaker: 'tik',
      recipient: 'marta',
      focus: tikPair,
      label: 'Тик и робот у стойки',
      predicate: 'robots',
      evidence: 'в паре те же два робота',
      independent: true,
      introduction: [
        'Марта, теперь я скажу о нас с напарником. Мы всё те же два робота.',
        'Назови нас с помощью местоимения: я тоже вхожу в эту пару.',
      ],
      success:
        'We are robots. Теперь о нас говорю я, один из двух роботов. Поэтому вместо they выбираю we.',
      rule: numberRule,
    }),
    exchange({
      suffix: 'you',
      words: ['You', 'are', 'robots'],
      alternatives: [
        ['We', 'are', 'robots'],
        ['They', 'are', 'robots'],
      ],
      shortcuts: ["You're", "We're", "They're"],
      speaker: 'lumi',
      recipient: 'tik',
      audience: tikPair,
      audienceLabel: 'Тик и робот у стойки',
      focus: tikPair,
      thirdGroup: porters,
      label: 'Тик и робот у стойки',
      predicate: 'robots',
      evidence: 'Люми обращается к обоим роботам',
      independent: true,
      introduction: [
        'Тик, вы с напарником оба роботы. Отметим это в списке пассажиров.',
        'Я обращаюсь к вам обоим: «Вы роботы». Как сказать это по-английски? Можно полной или сокращённой фразой.',
      ],
      success:
        'You are robots — «Вы роботы». Здесь you — вы оба: Тик и его напарник.',
      rule: numberRule,
    }),
    {
      ...group({
        pair: boxPair,
        other: childPair,
        suffix: 'boxes',
        rule: labelsRule,
        introduction: [
          'В новой накладной отдельно указаны два ящика и два ребёнка. Указатель сейчас у ящиков. Подпиши количество и вид груза.',
        ],
        success: 'Two boxes. В этой подписи нет be: она называет груз.',
      }),
      independent: true,
    },
    {
      ...group({
        pair: childPair,
        other: boxPair,
        suffix: 'children',
        rule: labelsRule,
        introduction: [
          'Теперь указатель у записи о двух детях. Выбери подпись для пассажиров, а не для ящиков.',
        ],
        success: 'Two children. Children уже означает множественное число.',
      }),
      independent: true,
    },
    exchange({
      suffix: 'one-robot',
      words: ['the', 'robot', 'is', 'ready'],
      alternatives: [['the', 'robots', 'are', 'ready']],
      speaker: 'marta',
      recipient: 'lumi',
      focus: ['porter-a'],
      label: 'указанный робот у стойки',
      evidence: 'сумка указанного робота закрыта',
      introduction: [
        'Люми, этот робот собрал сумку. Назовём его словом robot, без местоимения. Указатель помогает нам обоим понять, о каком роботе речь.',
        'The robot is ready — «Этот робот готов». Подлежащее здесь the robot. Оно в единственном числе, поэтому нужна форма is.',
        'The возможно и с одним, и с несколькими известными участниками. Сейчас указатель выделяет одного.',
      ],
      success:
        'The robot is ready — «Этот робот готов». Нам обоим понятно, о каком роботе речь, поэтому нужен the. Робот один, поэтому is.',
      rule: numberRule,
    }),
    exchange({
      suffix: 'two-robots',
      words: ['the', 'robots', 'are', 'ready'],
      alternatives: [['the', 'robot', 'is', 'ready']],
      speaker: 'marta',
      recipient: 'lumi',
      focus: porters,
      label: 'оба робота у стойки',
      evidence: 'обе сумки закрыты',
      independent: true,
      introduction: [
        'Теперь обе сумки закрыты. Запишем, что готовы оба робота у стойки.',
        'Мы с тобой знаем, о каких роботах речь. Вспомни, какая форма be нужна, когда их несколько.',
      ],
      success:
        'The robots are ready — «Эти роботы готовы». Robots — несколько роботов, поэтому нужна форма are. The остаётся: речь о тех же роботах у стойки.',
      rule: numberRule,
    }),
  ],
  'Почему We are robots и They are robots могут описывать одну и ту же пару?',
);

const negatives = chain(
  'chapter-02-13',
  [
    exchange({
      suffix: 'i',
      words: ['I', 'am', 'not', 'ready'],
      alternatives: [
        ['I', 'am', 'ready'],
        ['You', 'are', 'not', 'ready'],
      ],
      shortcuts: ["I'm", "You're"],
      speaker: 'tik',
      recipient: 'marta',
      focus: ['tik'],
      label: 'Тик',
      ready: false,
      evidence: 'Тик открыл сумку, инструменты ещё на столе',
      introduction: [
        'Марта, я открыл сумку за запасной шестерёнкой. Инструменты ещё на столе, так что я пока не готов.',
        'Чтобы сказать «не», после be ставим not. I am not ready — «Я не готов». Это отрицание.',
        'Можно сократить I am: I’m not ready. Not остаётся отдельным словом. Помоги мне сказать Марте, что я ещё не готов.',
      ],
      success:
        'I am not ready — «Я не готов». Not после am означает «не». Мне ещё нужно убрать инструменты в сумку.',
      rule: negativeRule,
    }),
    exchange({
      suffix: 'they',
      words: ['They', 'are', 'not', 'ready'],
      alternatives: [
        ['They', 'are', 'ready'],
        ['We', 'are', 'not', 'ready'],
      ],
      shortcuts: ["They're", "We're", "aren't"],
      speaker: 'lumi',
      recipient: 'marta',
      focus: porters,
      label: 'два робота у стойки',
      ready: false,
      evidence: 'ящик обоих роботов ещё не закреплён',
      baggage: 'crate',
      introduction: [
        'У роботов у стойки тоже не всё готово: ремень на ящике ещё не затянут. Я сообщаю о них Марте.',
        'They are not ready можно сократить двумя способами: They’re not ready или They aren’t ready. Aren’t = are not; это одна плитка.',
        'Оба сокращения допустимы. Начинай слева и оставляй неиспользованные клетки справа пустыми.',
      ],
      success:
        'They are not ready. У обеих коротких записей тот же смысл: They’re not ready и They aren’t ready.',
      rule: negativeRule,
    }),
    exchange({
      suffix: 'he',
      words: ['He', 'is', 'not', 'ready'],
      alternatives: [
        ['He', 'is', 'ready'],
        ['She', 'is', 'not', 'ready'],
      ],
      shortcuts: ["He's", "She's", "isn't"],
      speaker: 'marta',
      recipient: 'lumi',
      focus: ['tik'],
      label: 'Тик',
      ready: false,
      evidence: 'Тик ещё укладывает инструменты',
      introduction: [
        'Люми, Тик ещё укладывает инструменты. Помоги мне сказать, что он пока не готов. Используй he.',
        'He is not ready = He’s not ready = He isn’t ready. Isn’t сокращает is not. Выбери любую из этих форм.',
      ],
      success:
        'He is not ready — «Он не готов». Я говорю о Тике, поэтому здесь he. Он ещё собирает инструменты.',
      rule: negativeRule,
    }),
    exchange({
      suffix: 'ready-again',
      words: ['We', 'are', 'ready'],
      alternatives: [
        ['We', 'are', 'not', 'ready'],
        ['They', 'are', 'ready'],
      ],
      shortcuts: ["We're", "They're", "aren't"],
      speaker: 'lumi',
      recipient: 'marta',
      focus: pair,
      label: 'Люми и Тик',
      selfGroup: pair,
      evidence: 'Марта помогла закрепить сумки Люми и Тика',
      independent: true,
      introduction: [
        'Спасибо, Марта, застёжка держится. Наши с Тиком сумки теперь собраны.',
        'Мы закончили сборы. Помоги мне сообщить об этом от нас обоих. Выбирай только те слова, которые нужны.',
      ],
      success:
        'We are ready — «Мы готовы». Теперь наши сумки собраны, поэтому говорю без not.',
      rule: negativeRule,
    }),
  ],
  'Что определяет, нужно ли not в сообщении о готовности?',
);

const questions = chain(
  'chapter-02-14',
  [
    exchange({
      suffix: 'tik-no',
      words: ['are', 'You', 'ready'],
      alternatives: [
        ['You', 'are', 'ready'],
        ['is', 'He', 'ready'],
      ],
      shortcuts: ["You're"],
      speaker: 'lumi',
      recipient: 'tik',
      focus: ['tik'],
      label: 'Тик',
      ready: false,
      evidence: 'Тик ещё закрепляет новый почтовый свёрток',
      act: 'question',
      introduction: [
        'Тик получил ещё один свёрток. Я не видел, успел ли он закрепить его, и хочу спросить самого Тика.',
        'Общий вопрос позволяет узнать «да» или «нет». С be меняем порядок: You are ready — «Ты готов», Are you ready? — «Ты готов?»',
        'Поставь are перед you. Знак вопроса появится сам. Нам важно узнать ответ Тика — «да» или «нет».',
      ],
      quest: 'Люми не знает, готов ли Тик. Помоги ему спросить об этом Тика.',
      success:
        'Тик ответил: «Нет, пока не готов. Ещё закрепляю свёрток». Теперь я знаю, что ему нужно ещё немного времени.',
      rule: questionRule,
    }),
    exchange({
      suffix: 'tik-yes',
      words: ['are', 'You', 'ready'],
      alternatives: [
        ['You', 'are', 'ready'],
        ['is', 'He', 'ready'],
      ],
      shortcuts: ["You're"],
      speaker: 'lumi',
      recipient: 'tik',
      focus: ['tik'],
      label: 'Тик',
      evidence: 'Тик закрепил свёрток и закрыл сумку',
      act: 'question',
      independent: true,
      introduction: [
        'Прошла минута. Я смотрел на расписание и не видел, закончил ли Тик. Спрошу его ещё раз.',
        'Помоги мне спросить Тика, готов ли он теперь. Ответ узнаем у него.',
      ],
      quest: 'Уточни у Тика, готов ли он теперь.',
      success:
        'Тик ответил: «Да, теперь готов. Свёрток закреплён». Вопрос тот же, но теперь Тик закончил сборы и ответил «да».',
      rule: questionRule,
    }),
    exchange({
      suffix: 'marta',
      words: ['is', 'She', 'ready'],
      alternatives: [
        ['She', 'is', 'ready'],
        ['is', 'He', 'ready'],
      ],
      shortcuts: ["She's", "He's"],
      speaker: 'lumi',
      recipient: 'tik',
      focus: ['marta'],
      label: 'Марта',
      evidence: 'Марта закрыла дорожную сумку',
      act: 'question',
      introduction: [
        'Тик, ты видел, собралась ли Марта? Я спрашиваю тебя о ней, а не обращаюсь к ней самой.',
        'О Марте используем she. В вопросе форма is идёт перед she: Is she ready?',
      ],
      quest: 'Люми спрашивает Тика о готовности Марты.',
      success:
        'Тик отвечает: «Да, Марта готова». Is she ready? относится к Марте, хотя отвечает Тик.',
      rule: questionRule,
    }),
    exchange({
      suffix: 'group',
      words: ['are', 'They', 'ready'],
      alternatives: [
        ['They', 'are', 'ready'],
        ['are', 'We', 'ready'],
      ],
      shortcuts: ["They're", "We're"],
      speaker: 'marta',
      recipient: 'lumi',
      focus: porters,
      label: 'два робота у стойки',
      ready: false,
      evidence: 'роботы ещё проверяют крепление ящика',
      baggage: 'crate',
      act: 'question',
      independent: true,
      introduction: [
        'Люми, уточню у тебя, готовы ли роботы у стойки. Я не видела, закончили ли они проверку.',
        'Речь о другой группе. Собери нейтральный вопрос с they.',
      ],
      quest: 'Марта спрашивает Люми о двух роботах у стойки.',
      success:
        'Люми ответил: «Нет, они ещё проверяют крепление». Хорошо, подождём. Я спросила, готовы ли они, и получила ответ.',
      rule: questionRule,
    }),
  ],
  'Как понять, что мы правильно задали вопрос о готовности?',
);

const positiveAnswers = chain(
  'chapter-02-15',
  [
    exchange({
      suffix: 'i',
      words: ['Yes', 'I', 'am'],
      alternatives: [
        ['Yes', 'You', 'are'],
        ['Yes', 'I', 'am', 'ready'],
      ],
      shortcuts: ["I'm", "You're"],
      speaker: 'lumi',
      recipient: 'marta',
      focus: ['lumi'],
      label: 'Люми',
      evidence: 'сумка Люми собрана',
      act: 'short-answer',
      question: 'Марта спрашивает Люми: Are you ready?',
      introduction: [
        'Марта спрашивает меня: Are you ready? Моя сумка собрана, поэтому я отвечу «да». Yes — «да».',
        'В её вопросе you — это я, Люми. Но в своём ответе я говорю о себе: Yes, I am — «Да». Это положительный короткий ответ.',
        'В таком коротком ответе am оставляем целиком. Yes, I’m не подходит. Yes, I am ready — правильный полный ответ, но сейчас нужен короткий, без ready.',
      ],
      quest: 'Ответь за Люми коротко и утвердительно. Его сумка собрана.',
      success:
        'Yes, I am. Марта обратилась ко мне со словом you. А я отвечаю о себе, поэтому выбираю I.',
      rule: answerRule,
    }),
    exchange({
      suffix: 'we',
      words: ['Yes', 'We', 'are'],
      alternatives: [
        ['Yes', 'They', 'are'],
        ['Yes', 'We', 'are', 'ready'],
      ],
      shortcuts: ["We're", "They're"],
      speaker: 'lumi',
      recipient: 'marta',
      focus: pair,
      label: 'Люми и Тик',
      selfGroup: pair,
      evidence: 'обе сумки собраны',
      act: 'short-answer',
      question: 'Марта спрашивает Люми и Тика: Are you ready?',
      introduction: [
        'Теперь Марта обращается к нам обоим. Наши с Тиком сумки собраны, и я отвечаю за нашу пару.',
        'В коротком ответе выбери местоимение, которое включает меня. Форму are не сокращай.',
      ],
      quest:
        'Люми отвечает Марте за себя и Тика. Нужен положительный короткий ответ.',
      success:
        'Yes, we are. Я отвечаю за нас с Тиком, поэтому выбираю we. В этом коротком ответе are не сокращается.',
      rule: answerRule,
    }),
    exchange({
      suffix: 'he',
      words: ['Yes', 'He', 'is'],
      alternatives: [
        ['Yes', 'She', 'is'],
        ['Yes', 'He', 'is', 'ready'],
      ],
      shortcuts: ["He's", "She's"],
      speaker: 'marta',
      recipient: 'lumi',
      focus: ['tik'],
      label: 'Тик',
      evidence: 'свёрток Тика закреплён',
      act: 'short-answer',
      question: 'Люми спрашивает Марту о Тике: Is he ready?',
      independent: true,
      introduction: [
        'Люми спрашивает меня о Тике: Is he ready? Да, Тик закрепил свёрток.',
        'Ответь коротко от моего имени. Я сообщаю о Тике, а не о себе: местоимение должно относиться к нему.',
      ],
      quest:
        'Марта отвечает Люми: Тик готов. Собери положительный короткий ответ от её имени.',
      success:
        'Yes, he is. Я отвечаю о Тике, поэтому здесь he. Сегодня мы отвечали «да», а дальше потренируемся отвечать «нет».',
      rule: answerRule,
    }),
  ],
  'Почему в коротком ответе нужно Yes, I am, а не Yes, I’m?',
);

export const departureLevels = {
  'chapter-02-11': groups,
  'chapter-02-12': passengerList,
  'chapter-02-13': negatives,
  'chapter-02-14': questions,
  'chapter-02-15': positiveAnswers,
};
export const departureReflections = {
  'chapter-02-11': {
    correct: 'group-author',
    title: 'Кто входит в группу?',
    choices: [
      {
        id: 'group-author',
        label: 'С we говорящий входит в группу, с they — нет',
        feedback:
          'Верно. Число участников может быть одинаковым. We и they различаются тем, входит ли в группу говорящий.',
      },
      {
        id: 'group-size',
        label: 'We — для двоих, they — только для троих и больше',
        feedback:
          'И we, и they могут означать двух участников. Когда Тик говорит о себе и напарнике, нужно we. Когда Марта говорит о них — they.',
      },
      {
        id: 'group-ready-s',
        label: 'У we нужно добавить s к ready',
        feedback:
          'Ready — прилагательное, оно не меняется по числу. We are ready и They are ready.',
      },
    ],
  },
  'chapter-02-12': {
    correct: 'list-role',
    title: 'Та же пара, другой автор',
    choices: [
      {
        id: 'list-more',
        label: 'С we роботов стало больше',
        feedback:
          'В нашей паре оставались те же Тик и напарник. Количество не менялось.',
      },
      {
        id: 'list-role',
        label:
          'В одном случае автор входит в пару, в другом говорит о ней со стороны',
        feedback:
          'Верно. Тик говорит We are robots о себе и напарнике. Марта говорит о них They are robots. С названием тоже учитываем число: The robot is / The robots are.',
      },
      {
        id: 'list-the-one',
        label: 'The можно использовать только с одним роботом',
        feedback:
          'The бывает и с множественным числом: the robots. Оно показывает, что группа понятна участникам; are согласуется с robots.',
      },
    ],
  },
  'chapter-02-13': {
    correct: 'negative-fact',
    title: 'Нужно ли здесь not?',
    choices: [
      {
        id: 'negative-title',
        label: 'Not нужно во всех заданиях этого эпизода',
        feedback:
          'В последней части сумки уже собраны, поэтому We are ready без not. Выбирай слова по ситуации: готовы герои или ещё нет.',
      },
      {
        id: 'negative-fact',
        label: 'Not нужно, если участник или группа ещё не готовы',
        feedback:
          'Верно. I am not ready — «Я не готов»: not стоит после am. Когда герой соберётся, можно сказать I am ready, уже без not.',
      },
      {
        id: 'negative-magic',
        label: 'Not делает готового героя неготовым',
        feedback:
          'Слова описывают положение дел. Готовность меняется при сборе багажа, а не при перемещении not.',
      },
    ],
  },
  'chapter-02-14': {
    correct: 'question-answer',
    title: 'Узнать, а не угадать',
    choices: [
      {
        id: 'question-yes',
        label: 'Только когда персонаж отвечает «да»',
        feedback:
          '«Нет» — тоже ответ. Мы хотели узнать, готов ли Тик, и узнали, что он ещё собирается.',
      },
      {
        id: 'question-change',
        label: 'Когда слова сами делают персонажа готовым',
        feedback:
          'Вопрос помогает узнать, готов ли герой. Если сумка ещё открыта, от самого вопроса она не закроется.',
      },
      {
        id: 'question-answer',
        label: 'Когда задан нужный вопрос и получен ответ — «да» или «нет»',
        feedback:
          'Верно. В вопросах Are you ready? / Is she ready? / Are they ready? форма be стоит перед местоимением. Ответ может быть и «да», и «нет» — смотря как идут сборы.',
      },
    ],
  },
  'chapter-02-15': {
    correct: 'answer-full-be',
    title: 'Где сокращение не подходит?',
    choices: [
      {
        id: 'answer-never-short',
        label: 'I’m вообще нельзя использовать в английском',
        feedback:
          'I’m Lumi и I’m ready правильны. Ограничение касается положительного короткого ответа без продолжения после be.',
      },
      {
        id: 'answer-full-be',
        label: 'В положительном коротком ответе be оставляют целиком',
        feedback:
          'Верно: Yes, I am; Yes, we are; Yes, he is. Полное Yes, I’m ready тоже правильно, но уже не является коротким ответом этого задания.',
      },
      {
        id: 'answer-copy-you',
        label: 'В ответе нужно всегда копировать you из вопроса',
        feedback:
          'Местоимение зависит от автора ответа. Когда тебя спрашивают Are you ready?, о себе отвечаешь Yes, I am.',
      },
    ],
  },
} as const;
