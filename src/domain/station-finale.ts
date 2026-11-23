import type { LevelDefinition } from './levels';
import type { ParticipantId } from './station-chapter';
import { stationLesson, type StationLesson } from './station-next';
import { expandExchange, exchangeText } from './station-exchange';

export const finaleEpisodes = {
  'chapter-02-16': {
    id: 'chapter-02-16',
    noun: 'No',
    article: '',
    title: 'Нет, пока не готовы',
    quest: 'Ответь коротко: один герой или группа ещё не готовы.',
    reward: 'Ответы без догадок',
  },
  'chapter-02-17': {
    id: 'chapter-02-17',
    noun: 'Who',
    article: '',
    title: 'Кто здесь и что в ящике',
    quest: 'Выбери вопрос о человеке или предмете.',
    reward: 'Имена и находки',
  },
  'chapter-02-18': {
    id: 'chapter-02-18',
    noun: 'Where',
    article: '',
    title: 'Где попутчик',
    quest: 'Спроси, где Тик и помощники, и запиши ответы.',
    reward: 'Все нашлись',
  },
  'chapter-02-19': {
    id: 'chapter-02-19',
    noun: 'eight',
    article: '',
    title: 'Сколько тебе лет',
    quest: 'Прочитай переписку с пассажиркой и заполни её карточку.',
    reward: 'Карточки заполнены',
  },
  'chapter-02-20': {
    id: 'chapter-02-20',
    noun: 'ready',
    article: '',
    title: 'Перекличка перед дорогой',
    quest: 'Представься, спроси о сборах и помоги отправить сообщение.',
    reward: 'Станция встреч пройдена',
  },
} as const;
type FinaleId = keyof typeof finaleEpisodes;
type Lesson = {
  suffix: string;
  answer: string;
  accepted?: readonly string[];
  other?: readonly string[];
  tiles?: readonly string[];
  speaker: ParticipantId;
  recipient?: ParticipantId;
  author?: string;
  audience?: string;
  question?: string;
  ask?: boolean;
  short?: boolean;
  before: string;
  reply: string;
  quest: string;
  intro: readonly string[];
  success: string;
  rule: string;
  wrong: string;
  card: string;
  noun?: string;
  independent?: boolean;
};
const words = (text: string) => text.split(' ');
function lesson(data: Lesson): StationLesson {
  const accepted = [data.answer, ...(data.accepted ?? [])]
    .map(words)
    .map(expandExchange);
  const patterns = [
    ...new Map(
      [...accepted, ...(data.other ?? []).map(words).map(expandExchange)].map(
        (p) => [p.join(' '), p],
      ),
    ).values(),
  ];
  const recipient =
    data.recipient ?? (data.speaker === 'marta' ? 'lumi' : 'marta');
  return {
    suffix: data.suffix,
    words: accepted[0]!,
    alternatives: patterns.slice(1),
    distractors: data.tiles,
    frameLength: Math.max(...patterns.map((p) => p.length)),
    message: {
      speaker: data.speaker,
      recipient,
      intent: 'exchange',
      exchange: {
        act: data.ask ? 'question' : data.short ? 'short-answer' : 'statement',
        focus: [data.speaker],
        focusLabel: data.before,
        addressees: [recipient],
        audienceLabel:
          data.audience ??
          { lumi: 'Люми', marta: 'Марта', tik: 'Тик' }[recipient],
        selfGroup: [data.speaker],
        thirdGroup: [recipient],
        predicate: 'ready',
        ready: false,
        evidence: data.before,
        question: data.question,
        inquiry: {
          accepted,
          authorLabel: data.author,
          before: data.before,
          reply: data.reply,
          mismatch: data.wrong,
        },
      },
    },
    reference: {
      objects: [
        {
          id: data.suffix,
          noun: data.noun ?? 'book',
          label: data.before,
          display: 'record',
          caption: data.card,
        },
      ],
      indicatedId: data.suffix,
      markerLabel: 'Запись станции',
    },
    quest: data.quest,
    introduction: data.intro,
    success: data.success,
    rule: data.rule,
    hint: `Подходящая запись: ${exchangeText(words(data.answer))}${data.ask ? '?' : '.'} Начни с левого края рамки. Если выберешь сокращение, оставь свободные клетки справа пустыми.`,
    independent: data.independent,
  };
}
function chain(id: FinaleId, parts: readonly Lesson[], reflection: string) {
  let next: LevelDefinition | undefined;
  for (let i = parts.length - 1; i >= 0; i--) {
    const data = parts[i]!;
    const level = stationLesson(
      i ? `${id}-${data.suffix}` : id,
      finaleEpisodes[id].title,
      lesson(data),
    );
    // Two spaced rows keep longer questions and several alternatives movable.
    // This layout is limited to this block; existing voiced episodes keep theirs.
    const order = data.independent
      ? [
          ...level.pieces.filter((_, n) => n % 2),
          ...level.pieces.filter((_, n) => !(n % 2)),
        ]
      : [...level.pieces];
    if (order.length > 14 || level.slots.length > 7)
      throw new Error(`Board capacity: ${level.id}`);
    level.columns = 9;
    level.rows = 7;
    level.start = { x: 4, y: 6 };
    level.slots = level.slots.map((_, n) => ({
      x: Math.floor((9 - level.slots.length) / 2) + n,
      y: 1,
    }));
    level.pieces = order.map((p, n) => ({
      ...p,
      x: (n % 7) + 1,
      y: n < 7 ? 3 : 5,
    }));
    if (id === 'chapter-02-20' && data.suffix === 'no')
      level.presentation = {
        ...level.presentation!,
        continuationAction: 'Дать Тику время на сборы',
      };
    if (next) level.continuation = next;
    else
      level.presentation = {
        ...level.presentation!,
        success: [data.success, reflection],
        speakers: {
          task: data.intro.map(() => data.speaker),
          success: [data.speaker, data.speaker],
        },
      };
    next = level;
  }
  return next!;
}
const negativeRule =
  'No — «нет». Отрицательный короткий ответ с be: No + местоимение + am/is/are + not. Are you ready? — No, I am not: «Ты готов?» — «Нет». За свою группу: No, we are not. Можно сокращать: No, I’m not; No, we’re not; No, we aren’t. После сокращения остаётся not, поэтому это не тот случай, что Yes, I’m. Для he/she/it используем is not, isn’t или he’s/she’s/it’s not; для they — are not, aren’t или they’re not. Amn’t в этой модели не используем. Ответ выбираем по фактам, а местоимение — с точки зрения отвечающего. No, I am not ready тоже правильно, но это полный ответ; здесь тренируем короткий.';
const whRule =
  'Специальный вопрос просит назвать что-то конкретное, а не просто ответить «да» или «нет». Who — «кто»: Who is she? — «Кто она?» What — «что»: What is it? — «Что это?» В этих моделях порядок такой: вопросительное слово + be + местоимение. Это правило именно этих вопросов, а не всех английских вопросов с who. Ответ называет человека или предмет: She is Marta — «Она Марта»; It is an umbrella — «Это зонт». Для обычного предмета здесь используем it, для Марты — she, для Тика — he. Перед именем нет a/an; перед одним предметом в таком описании нужен артикль.';
const whereRule =
  'Where — «где»: спрашиваем о месте. Where is he? — «Где он?» Where are they? — «Где они?» Порядок: where + be + местоимение. Here — «здесь», рядом с говорящим: He is here — «Он здесь». At the station — готовое выражение «на станции»: They are at the station — «Они на станции». At — предлог, он входит в это выражение вместе с the и station. Другие предлоги места разберём позже. Здесь мы на станции, поэтому «здесь» и «на станции» могут быть двумя верными ответами. Who спрашивает, кто это; where — где он находится.';
const ageRule =
  'How old — «сколько лет» в вопросе о возрасте. How old are you? — «Сколько тебе лет?» О другом человеке: How old is she? — «Сколько ей лет?» Возраст сообщаем с be: I am eight — «Мне восемь лет»; She is six — «Ей шесть лет». Можно добавить years old: I am eight years old. Обе записи верны. Year — «год», years — «годы», old отдельно значит «старый», но years old здесь — выражение возраста, а не оценка человека. Числа: one — 1, two — 2, three — 3, four — 4, five — 5, six — 6, seven — 7, eight — 8, nine — 9, ten — 10. Нужные числа показаны на карточке до задания; здесь проверяем построение фразы, а не счёт.';

const negative = chain(
  'chapter-02-16',
  [
    ...(
      [
        [
          'we',
          'We',
          'are',
          "We're",
          "aren't",
          'lumi',
          'Люми и Тик',
          'Are you ready?',
          'Наши с Тиком сумки ещё открыты. Марта спрашивает нас обоих, готовы ли мы.',
          'Ответь от Люми за себя и Тика.',
          'Люми и Тик\nне готовы',
        ],
        [
          'i',
          'I',
          'am',
          "I'm",
          '',
          'tik',
          'Тик',
          'Are you ready?',
          'Теперь Марта спрашивает только меня. Моя сумка ещё не собрана.',
          'Тик отвечает о себе. Дай короткий отрицательный ответ.',
          'Тик\nне готов',
        ],
        [
          'he',
          'He',
          'is',
          "He's",
          "isn't",
          'lumi',
          'Тик',
          'Is he ready?',
          'Марта спрашивает меня о Тике. Он ещё собирает сумку.',
          'Люми отвечает Марте о Тике. Ответь коротко.',
          'Тик\nне готов',
        ],
        [
          'she',
          'She',
          'is',
          "She's",
          "isn't",
          'tik',
          'Марта',
          'Is she ready?',
          'Люми спрашивает меня о Марте. Ей ещё нужно сложить инструменты.',
          'Тик отвечает Люми о Марте. Ответь коротко.',
          'Марта\nне готова',
        ],
        [
          'they',
          'They',
          'are',
          "They're",
          "aren't",
          'marta',
          'два робота у стойки',
          'Are they ready?',
          'Люми спрашивает о двух помощниках у стойки. Их почтовые сумки ещё не собраны.',
          'Марта отвечает о двух других роботах. Ответь коротко.',
          'Помощники\nне готовы',
        ],
      ] as const
    ).map(
      (
        [
          suffix,
          subject,
          be,
          contraction,
          negativeBe,
          speaker,
          label,
          question,
          intro,
          quest,
          card,
        ],
        index,
      ): Lesson => ({
        suffix,
        answer: `No ${subject} ${be} not`,
        other: [`Yes ${subject} ${be}`, `No ${subject} ${be} not ready`],
        tiles: [contraction, ...(negativeBe ? [negativeBe] : [])],
        speaker,
        recipient: speaker === 'tik' && suffix === 'she' ? 'lumi' : undefined,
        short: true,
        question,
        before: `${label}: багаж не собран`,
        reply: `${label}: пока не ${subject === 'We' || subject === 'They' ? 'готовы' : subject === 'She' ? 'готова' : 'готов'}.`,
        card,
        quest,
        intro:
          index === 0
            ? [
                intro,
                'No значит «нет». Короткий отрицательный ответ: No, we are not — «Нет, мы не готовы». Ready уже было в вопросе, поэтому его можно не повторять.',
                'Можно и короче: No, we’re not или No, we aren’t. В отличие от Yes, we’re, эти ответы допустимы: после сокращения остаётся not.',
              ]
            : suffix === 'i'
              ? [
                  intro,
                  'О себе отвечаю I. No, I am not и No, I’m not означают одно и то же. Форму amn’t здесь не используем.',
                ]
              : [intro, quest],
        success: `${`No, ${subject.toLowerCase() === 'i' ? 'I' : subject.toLowerCase()} ${be} not`}. Ответ записан. Багаж ещё предстоит собрать.`,
        rule: negativeRule,
        wrong:
          'По записи багаж ещё не собран: нужен отрицательный ответ. Если ты добавил ready, получился правильный полный ответ; здесь нужен короткий, без ready.',
        independent: index > 1,
      }),
    ),
    {
      suffix: 'it',
      answer: 'No It is not',
      other: ['Yes It is'],
      tiles: ["It's", "isn't"],
      speaker: 'lumi',
      short: true,
      question: 'Is it an umbrella?',
      before: 'На карточке ключ, не зонт',
      card: 'Ключ',
      noun: 'key',
      reply: 'Нет, это ключ.',
      quest:
        'Марта спрашивает, зонт ли это. Люми отвечает о ключе на карточке. Дай короткий ответ.',
      intro: [
        'На карточке ключ. Марта спрашивает: Is it an umbrella? — «Это зонт?» Ответь от моего имени. It относится к предмету на карточке.',
      ],
      success:
        'No, it is not. Можно также No, it isn’t или No, it’s not. Мы ответили на вопрос о предмете, а не о чьей-то готовности.',
      rule: negativeRule,
      wrong: 'На карточке ключ. Утвердительный ответ назвал бы его зонтом.',
      independent: true,
    },
  ],
  'Почему No, I’m not подходит, а Yes, I’m — нет?',
);

const identity = chain(
  'chapter-02-17',
  [
    {
      suffix: 'who',
      answer: 'Who is She',
      other: ['What is She', 'Who is He'],
      speaker: 'lumi',
      recipient: 'tik',
      ask: true,
      before: 'Вопрос о Марте: назови её имя',
      reply: 'She is Marta. — Она Марта.',
      card: 'Марта\nимя',
      quest:
        'Люми учится спрашивать, кто перед ним. Спроси Тика о Марте, используя she.',
      intro: [
        'Я уже знаю Марту. Теперь хочу научиться спрашивать, кто передо мной. Who значит «кто». Who is she? — «Кто она?»',
        'Это специальный вопрос: в ответе нужно назвать человека, а не просто сказать «да». В этой модели сначала who, потом is, затем she. Попробую спросить Тика о Марте.',
      ],
      success:
        'Who is she? Тик ответил: She is Marta — «Она Марта». Who помогло спросить о человеке.',
      rule: whRule,
      wrong:
        'Здесь нужно спросить о Марте с she. What is she? возможно как вопрос о роде занятий или роли, но не является нашим вопросом об имени.',
    },
    {
      suffix: 'name',
      answer: 'She is Marta',
      other: ['He is Marta', 'She is Lumi'],
      tiles: ["She's"],
      speaker: 'tik',
      recipient: 'lumi',
      before: 'Тик отвечает об имени Марты',
      reply: 'Имя Марты записано.',
      card: 'Марта',
      question: 'Who is she?',
      quest: 'Ответь от Тика: назови Марту, начиная с she.',
      intro: [
        'Люми спросил меня о Марте. Теперь я отвечаю. Назови её имя, а вместо повторения имени в начале используй she.',
      ],
      success:
        'She is Marta. Перед именем артикль не нужен. She’s Marta — такой же ответ.',
      rule: whRule,
      wrong: 'Марта — she, и её имя Marta. Вопрос был о ней, а не о Люми.',
    },
    {
      suffix: 'what',
      answer: 'What is It',
      other: ['Who is It'],
      speaker: 'lumi',
      recipient: 'tik',
      ask: true,
      before: 'Закрытая посылка: предмет пока не показан',
      reply: 'It is an umbrella. — Это зонт.',
      card: 'Закрытая\nпосылка',
      quest: 'Спроси Тика, что за предмет в посылке. Используй it.',
      intro: [
        'Тик знает, что в этой посылке, а я пока не видел. What значит «что». What is it? — «Что это?»',
        'Вопрос строится так же: what, затем is и it. Who выбирали для человека, а здесь нужно узнать название обычного предмета.',
      ],
      success:
        'What is it? Тик ответил: It is an umbrella. В следующей записи уже можно назвать зонт.',
      rule: whRule,
      wrong:
        'Нужно узнать название предмета. Who is it? возможно, когда спрашивают, кто там, но наша посылка содержит обычный предмет.',
    },
    {
      suffix: 'umbrella',
      answer: 'It is an umbrella',
      other: ['It is a key'],
      tiles: ["It's"],
      speaker: 'tik',
      recipient: 'lumi',
      before: 'В посылке зонт',
      reply: 'Содержимое посылки записано.',
      card: 'Зонт',
      noun: 'umbrella',
      question: 'What is it?',
      quest: 'Тик отвечает Люми. Назови предмет, начиная с it.',
      intro: [
        'В посылке зонт. Запишем мой ответ Люми: назови один предмет. Вспомни артикль перед umbrella.',
      ],
      success:
        'It is an umbrella. Перед umbrella нужен an: слово начинается с гласного звука.',
      rule: whRule,
      wrong: 'Фраза построена верно, но в посылке зонт, а не ключ.',
    },
    {
      suffix: 'transfer',
      answer: 'Who is He',
      other: ['Who is She', 'What is He'],
      speaker: 'marta',
      recipient: 'lumi',
      ask: true,
      before: 'Марта просит Люми назвать Тика',
      reply: 'He is Tik. — Он Тик.',
      card: 'Тик\nимя',
      quest:
        'Марта проверяет, может ли Люми назвать Тика. Собери её вопрос с he.',
      intro: [
        'Люми, теперь вопрос задам я. Речь о Тике. Мне нужно его имя, а не место, где он стоит. Собери мой вопрос с местоимением he.',
      ],
      success:
        'Who is he? — He is Tik. Мы сменили человека, о котором спрашиваем, и выбрали he.',
      rule: whRule,
      wrong:
        'Нужно спросить о Тике: he. В этом задании спрашиваем имя, поэтому who.',
      independent: true,
    },
  ],
  'Какое слово поможет спросить, что лежит в посылке?',
);

const location = chain(
  'chapter-02-18',
  [
    {
      suffix: 'where',
      answer: 'Where is He',
      other: ['Who is He'],
      speaker: 'marta',
      recipient: 'lumi',
      ask: true,
      before: 'Марта спрашивает Люми, где Тик',
      reply: 'He is here. — Он здесь.',
      card: 'Где Тик?',
      quest: 'Спроси от Марты, где Тик. Используй he.',
      intro: [
        'Перед отправлением нужно проверить, все ли на месте. Where значит «где». Where is he? — «Где он?»',
        'Who помогало спросить, кто это. Теперь имя известно: Тик. Я спрашиваю Люми, где он находится.',
      ],
      success:
        'Where is he? Люми ответил: He is here. Здесь, на станции, рядом с ним.',
      rule: whereRule,
      wrong:
        'Who is he? спрашивает, кто он. Марта знает имя и спрашивает о месте: нужен where.',
    },
    {
      suffix: 'here',
      answer: 'He is here',
      accepted: ['He is at the station'],
      other: ['She is here'],
      tiles: ["He's"],
      speaker: 'lumi',
      before: 'Тик рядом с Люми на станции',
      reply: 'Тик здесь, на станции.',
      card: 'Тик\nрядом с Люми',
      question: 'Where is he?',
      quest:
        'Ответь Марте о Тике с he. Можно сказать «здесь» или «на станции».',
      intro: [
        'Тик рядом со мной. Here значит «здесь»: He is here — «Он здесь».',
        'At the station — «на станции». Это готовое выражение: at — предлог, station — «станция», the относится к знакомой нам станции. He is at the station здесь тоже верно.',
      ],
      success:
        'Тик здесь, на станции. Оба ответа подходят: He is here и He is at the station. Можно сократить he is до he’s.',
      rule: whereRule,
      wrong:
        'She is here — верная фраза, но она относится к Марте. Сейчас отвечаем о Тике: he.',
    },
    {
      suffix: 'group-question',
      answer: 'Where are They',
      other: ['Who are They'],
      speaker: 'lumi',
      recipient: 'tik',
      ask: true,
      before: 'Люми спрашивает о двух роботах-помощниках',
      reply: 'They are at the station. — Они на станции.',
      card: 'Где два\nпомощника?',
      quest: 'Спроси Тика, где два помощника. Используй they.',
      intro: [
        'Теперь нужно найти двух помощников. Тик, они ещё на станции? Составь мой вопрос о месте, используя they.',
      ],
      success:
        'Where are they? Вопрос о нескольких, поэтому they are меняется на where are they.',
      rule: whereRule,
      wrong:
        'Who are they? спрашивает, кто они. Здесь нужно выяснить, где находятся помощники.',
      independent: true,
    },
    {
      suffix: 'group-answer',
      answer: 'They are at the station',
      accepted: ['They are here'],
      other: ['We are at the station'],
      tiles: ["They're"],
      speaker: 'tik',
      recipient: 'lumi',
      before: 'Два помощника рядом с Тиком на станции',
      reply: 'Оба помощника на станции.',
      card: 'Два помощника\nу стойки',
      question: 'Where are they?',
      quest: 'Тик отвечает о двух других роботах. Используй they.',
      intro: [
        'Оба помощника здесь, у стойки. Ответь Люми от моего имени. Речь о них двоих, я в эту группу не вхожу.',
      ],
      success:
        'They are at the station. Можно сказать и They are here: оба помощника рядом со мной. They — о них, we включало бы меня.',
      rule: whereRule,
      wrong:
        'We включало бы Тика, а вопрос был о двух других роботах. Выбери they.',
      independent: true,
    },
  ],
  'Почему в вопросе Where are they? стоит are?',
);

const age = chain(
  'chapter-02-19',
  [
    {
      suffix: 'age-question',
      answer: 'How old are You',
      other: ['How old is She'],
      speaker: 'marta',
      audience: 'Нора · переписка',
      ask: true,
      before: 'Письмо Норе: спрашиваем её возраст',
      reply: 'I am eight. — Мне восемь лет.',
      card: 'Переписка\nс Норой',
      quest:
        'Марта пишет пассажирке Норе. Спроси её возраст, обращаясь к ней напрямую.',
      intro: [
        'Для списка нужны карточки пассажиров. Нора ещё не пришла: заполним её карточку по переписке. Её нет на нашей площадке.',
        'How old are you? — «Сколько тебе лет?» How old — вопрос о возрасте. При обращении к собеседнику нужны you и are.',
        'Нора ответит I am eight — «Мне восемь лет». Eight — восемь. Возраст по-английски в этой модели сообщают с be.',
      ],
      success:
        'How old are you? Пришёл ответ Норы: I am eight. В следующей части прочитаем его от её лица.',
      rule: ageRule,
      wrong:
        'How old is she? — вопрос о другой девочке. Марта пишет самой Норе, поэтому обращается к ней с you.',
    },
    {
      suffix: 'nora',
      answer: 'I am eight',
      accepted: ['I am eight years old'],
      other: ['I am six'],
      tiles: ["I'm"],
      speaker: 'marta',
      author: 'Нора · текст письма',
      audience: 'Марта',
      before: 'Письмо Норы: ей 8 лет (eight)',
      reply: 'Ответ Норы переписан.',
      card: 'Нора: 8 лет\neight = 8',
      question: 'How old are you?',
      quest:
        'Перепиши ответ Норы от её лица: «Мне восемь лет». Марта читает письмо, но автор ответа — Нора.',
      intro: [
        'Я читаю письмо Норы. Дальше собираем её слова, не мои: I в ответе означает Нору.',
        'I am eight и I am eight years old — оба варианта означают «Мне восемь лет». Years old — выражение возраста. Year значит «год», years — «годы». Old здесь не означает, что Нора старая.',
        'Можно сократить I am до I’m. Возраст на карточке уже указан: восемь, eight. Six — шесть; это возраст другой пассажирки.',
      ],
      success:
        'Ответ Норы: I am eight. Можно добавить years old или сократить I am до I’m. Возраст от этого не изменится.',
      rule: ageRule,
      wrong:
        'Норе восемь лет: eight. Six означает шесть и не совпадает с её письмом.',
    },
    {
      suffix: 'other-age',
      answer: 'How old is She',
      other: ['How old are You'],
      speaker: 'lumi',
      ask: true,
      before: 'Люми спрашивает Марту о пассажирке на второй карточке',
      reply: 'She is six. — Ей шесть лет.',
      card: 'Вторая\nпассажирка',
      quest:
        'Спроси Марту о возрасте девочки на второй карточке. Используй she.',
      intro: [
        'На второй карточке другая девочка. Я спрашиваю не её, а Марту. Как узнать, сколько лет этой девочке? Используй she.',
      ],
      success:
        'How old is she? Мы спрашиваем о ней, а не обращаемся к ней. Марта прочитала возраст: шесть лет, six.',
      rule: ageRule,
      wrong:
        'You обращалось бы к Марте. Вопрос о девочке на карточке, поэтому she.',
      independent: true,
    },
    {
      suffix: 'six',
      answer: 'She is six',
      accepted: ['She is six years old'],
      other: ['She is eight'],
      tiles: ["She's"],
      speaker: 'marta',
      before: 'Вторая пассажирка: 6 лет (six)',
      reply: 'Возраст второй пассажирки записан.',
      card: 'Девочка: 6 лет\nsix = 6',
      question: 'How old is she?',
      quest: 'Марта отвечает Люми о девочке на второй карточке. Начни с she.',
      intro: [
        'На этой карточке шесть лет: six. Ответь Люми от моего имени. Мы говорим о девочке; возраст не мой.',
      ],
      success:
        'She is six. She is six years old тоже подходит. Для she выбираем is, как в уже знакомом She is Marta.',
      rule: ageRule,
      wrong:
        'На второй карточке шесть лет. Eight означает восемь: это возраст Норы.',
      independent: true,
    },
  ],
  'Какая форма нужна, чтобы сказать о себе «Мне восемь лет»?',
);

const reviewRule = `${negativeRule}\n\n${whRule}\n\n${whereRule}\n\n${ageRule}`;
const reviewBase = { rule: reviewRule, independent: true };
const review = chain(
  'chapter-02-20',
  [
    {
      ...reviewBase,
      suffix: 'self',
      answer: 'I am Lumi',
      other: ['I am Tik'],
      tiles: ["I'm"],
      speaker: 'lumi',
      before: 'Люми сообщает своё имя Марте',
      reply: 'Имя Люми в списке.',
      card: 'Имя\nотправителя',
      quest: 'Люми представляется Марте. Собери сообщение от его лица.',
      intro: [
        'Перед дорогой проверим последние записи. Я начну с себя: нужно сообщить моё имя Марте.',
      ],
      success: 'Моё имя в списке. Теперь проверим запись о Тике.',
      wrong:
        'Автор сообщения — Люми. Имя Tik в его сообщении не совпадало бы с тем, кто говорит.',
    },
    {
      ...reviewBase,
      suffix: 'friend',
      answer: 'He is a robot',
      other: ['He is a lantern'],
      tiles: ["He's"],
      speaker: 'lumi',
      before: 'Люми рассказывает Марте о Тике',
      reply: 'Описание Тика записано.',
      card: 'Тик\nпочтовый робот',
      quest:
        'Люми сообщает Марте, кто такой Тик. Начни с he и назови вид героя, не имя.',
      intro: [
        'Я рассказываю Марте о Тике. Нужно написать, что он робот, а не повторить его имя. Начни с he.',
      ],
      success:
        'Тик — робот. Артикль перед названием одного представителя вида пригодился и здесь.',
      wrong:
        'Тик — робот, а фонарь — Люми. Форма верная, но описание не совпадает с героем.',
    },
    {
      ...reviewBase,
      suffix: 'ask',
      answer: 'are You ready',
      other: ['You are ready'],
      speaker: 'lumi',
      recipient: 'tik',
      ask: true,
      before: 'Люми ещё не получил ответ Тика о сборах',
      reply: 'No, I am not. Сумка Тика ещё не собрана.',
      card: 'Ожидаем\nответа Тика',
      quest:
        'Люми спрашивает самого Тика, готов ли он. Собери нейтральный вопрос.',
      intro: [
        'Тик, я ещё не спросил, как твои сборы. Помоги мне задать ему вопрос.',
      ],
      success:
        'Ответ получен: Тик пока не готов. Вопрос выполнил свою задачу, хотя ответ оказался отрицательным.',
      wrong:
        'You are ready — утверждение. Люми пока не знает ответа; нужен нейтральный вопрос с be перед you.',
    },
    {
      ...reviewBase,
      suffix: 'no',
      answer: 'No I am not',
      other: ['Yes I am', 'No I am not ready'],
      tiles: ["I'm"],
      speaker: 'tik',
      recipient: 'lumi',
      short: true,
      question: 'Are you ready?',
      before: 'Сумка Тика ещё открыта',
      reply: 'Тик сообщил, что пока не готов.',
      card: 'Тик\nне готов',
      quest: 'Тик отвечает Люми о себе. Дай короткий ответ по записи о багаже.',
      intro: [
        'Моя сумка ещё открыта. Ответь Люми от моего имени — коротко, без повторения ready.',
      ],
      success: 'Я сообщил, что пока не готов. Можно спокойно закончить сборы.',
      wrong:
        'Сумка ещё не собрана, поэтому ответ отрицательный. С ready получится верный полный ответ; здесь требуется короткий.',
    },
    {
      ...reviewBase,
      suffix: 'yes',
      answer: 'Yes I am',
      other: ['No I am not'],
      tiles: ["I'm"],
      speaker: 'tik',
      recipient: 'lumi',
      short: true,
      question: 'Are you ready?',
      before: 'Позже: Тик собрал и закрыл сумку',
      reply: 'Тик готов к дороге.',
      card: 'Позже\nсумка собрана',
      quest:
        'После сборов Люми спрашивает Тика ещё раз. Ответь от Тика коротко.',
      intro: [
        'Прошло немного времени. Я сложил почту и закрыл сумку. Теперь я готов. Люми спрашивает меня ещё раз — ответ будет другим.',
      ],
      success:
        'Теперь можно ответить «да». Готовность изменилась потому, что я собрал сумку, а не потому, что мы выбрали Yes.',
      wrong:
        'В этой части сумка уже собрана. Нужен положительный короткий ответ. Be в нём оставляем целиком.',
    },
    {
      ...reviewBase,
      suffix: 'together',
      answer: 'We are ready',
      other: ['They are ready'],
      tiles: ["We're", "They're"],
      speaker: 'lumi',
      before: 'Сумки Люми и Тика собраны. Марта остаётся на станции',
      reply: 'Люми и Тик готовы отправиться к садам.',
      card: 'Люми и Тик\nготовы',
      quest:
        'Люми сообщает Марте о себе и Тике. Используй местоимение для своей группы.',
      intro: [
        'Мы с Тиком собрали сумки. Марта остаётся здесь и потом вернётся в мастерскую. Я скажу ей, что мы готовы.',
      ],
      success:
        'Марта проводила нас до станции. Дальше идём вдвоём с Тиком — к садам. Там после бури остались чужие вещи: нужно будет узнать, кому они принадлежат. Это уже следующая глава.',
      wrong:
        'Люми говорит о группе, в которую входит сам. They означало бы другую группу; здесь нужно we.',
    },
  ],
  'Что помогло выбрать ответы на перекличке?',
);

export const finaleLevels = {
  'chapter-02-16': negative,
  'chapter-02-17': identity,
  'chapter-02-18': location,
  'chapter-02-19': age,
  'chapter-02-20': review,
} as const;
export const finaleReflections = {
  'chapter-02-16': {
    correct: 'negative-tail',
    title: 'Сокращение в ответе',
    choices: [
      {
        id: 'negative-tail',
        label: 'В No, I’m not после сокращения остаётся not',
        feedback:
          'Верно. No, I am not и No, I’m not допустимы. В Yes, I am после be нет продолжения, поэтому am оставляем целиком.',
      },
      {
        id: 'negative-always-no',
        label: 'В коротких ответах всегда нужен No',
        feedback:
          'No нужен, когда ответ отрицательный. Если герой готов, он отвечает Yes, I am.',
      },
    ],
  },
  'chapter-02-17': {
    correct: 'what-object',
    title: 'Вопрос о предмете',
    choices: [
      {
        id: 'who-object',
        label: 'Who is it?',
        feedback:
          'Так можно спросить «Кто это?», например о человеке за дверью. В нашей посылке обычный предмет, и нужно узнать его название.',
      },
      {
        id: 'what-object',
        label: 'What is it?',
        feedback:
          'Верно. What is it? спрашивает «Что это?» Ответ может назвать предмет: It is an umbrella.',
      },
    ],
  },
  'chapter-02-18': {
    correct: 'where-agreement',
    title: 'Где двое?',
    choices: [
      {
        id: 'where-always-are',
        label: 'После where всегда нужно are',
        feedback:
          'Where is he? тоже правильно. Форма зависит от того, о ком спрашиваем, а не от where.',
      },
      {
        id: 'where-agreement',
        label: 'Вопрос о группе: с they нужна форма are',
        feedback:
          'Верно. Where is he? — об одном; Where are they? — о группе. Where в обоих случаях спрашивает о месте.',
      },
    ],
  },
  'chapter-02-19': {
    correct: 'age-be',
    title: 'Возраст с be',
    choices: [
      {
        id: 'age-be',
        label: 'I am eight или I am eight years old',
        feedback:
          'Верно. В этой модели возраст сообщаем с be. I’m eight тоже подходит.',
      },
      {
        id: 'age-without-be',
        label: 'I eight',
        feedback:
          'В русском «Мне восемь» глагол не нужен. В английском здесь нужна форма am: I am eight.',
      },
    ],
  },
  'chapter-02-20': {
    correct: 'rollcall-context',
    title: 'Перед следующей дорогой',
    choices: [
      {
        id: 'rollcall-always-yes',
        label: 'Нужно всем отвечать Yes, чтобы отправиться',
        feedback:
          'Когда сумка была открыта, Тик правильно отвечал No, I am not. Сначала он закончил сборы, и только потом ответ изменился.',
      },
      {
        id: 'rollcall-context',
        label: 'Кто говорит, о ком спрашивают и что происходит',
        feedback:
          'Верно. Местоимение зависит от участников разговора, форма be — от подлежащего, а Yes или No — от фактов. Станция встреч пройдена. Сады пока готовятся; можно вернуться к любому открытому эпизоду.',
      },
    ],
  },
} as const;
