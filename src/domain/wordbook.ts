import type { Room } from './puzzle';

export const articleNotes = {
  a: 'Неопределённый артикль перед согласным звуком, с одним исчисляемым предметом. В просьбе a key подходит любой ключ; в I am a lantern называем вид героя. В сочетании обычно /ə/, отдельно может звучать /eɪ/.',
  an: 'Неопределённый артикль перед гласным звуком, с одним исчисляемым предметом. В просьбе an apple подходит любое яблоко. Это другая форма того же артикля, что a; выбор зависит от следующего звука. В сочетании часто /ən/, отдельно /æn/.',
  the: 'Определённый артикль: собеседнику понятно, какой предмет или какие предметы нужны. Часто /ðə/ перед согласным и /ði/ перед гласным; отдельно или под ударением /ðiː/.',
} as const;

export const wordbook = {
  Tik: {
    translation: 'Тик — имя почтового робота',
    pronunciation: '/tɪk/',
    note: 'Имя персонажа. Перед именем в I am Tik артикль не нужен.',
    audioPending: true,
  },
  No: {
    translation: 'нет',
    pronunciation: '/nəʊ/',
    note: 'Отрицательный ответ: No, I am not. Можно No, I’m not.',
    audioPending: true,
  },
  Who: {
    translation: 'кто',
    pronunciation: '/huː/',
    note: 'Who is she? — Кто она? Вопрос об имени или личности.',
    audioPending: true,
  },
  What: {
    translation: 'что',
    pronunciation: '/wɒt/',
    note: 'What is it? — Что это? В наших заданиях спрашиваем о предмете.',
    audioPending: true,
  },
  Where: {
    translation: 'где',
    pronunciation: '/weə/',
    note: 'Where is he? — Где он? Вопрос о месте.',
    audioPending: true,
  },
  here: {
    translation: 'здесь',
    pronunciation: '/hɪə/',
    note: 'He is here — Он здесь, рядом с говорящим.',
    audioPending: true,
  },
  at: {
    translation: 'на / у — здесь часть at the station',
    pronunciation: '/ət/',
    note: 'At the station — на станции. Учим целое выражение; это не универсальный перевод at.',
    audioPending: true,
  },
  station: {
    translation: 'станция',
    pronunciation: '/ˈsteɪʃən/',
    note: 'They are at the station — Они на станции.',
    audioPending: true,
  },
  How: {
    translation: 'как — здесь часть how old',
    pronunciation: '/haʊ/',
    note: 'How old are you? — Сколько тебе лет? Значение вопроса определяется сочетанием how old.',
    audioPending: true,
  },
  old: {
    translation: 'старый; в how old / years old — возраст',
    pronunciation: '/əʊld/',
    note: 'I am eight years old — Мне восемь лет. Это сообщение о возрасте, а не о старости.',
    audioPending: true,
  },
  years: {
    translation: 'годы',
    pronunciation: '/jɪəz/',
    note: 'Множественное число year. Eight years old — восемь лет (о возрасте).',
    audioPending: true,
  },
  eight: {
    translation: 'восемь',
    pronunciation: '/eɪt/',
    note: 'I am eight — Мне восемь лет. На карточке: 8.',
    audioPending: true,
  },
  six: {
    translation: 'шесть',
    pronunciation: '/sɪks/',
    note: 'She is six — Ей шесть лет. На карточке: 6.',
    audioPending: true,
  },
  We: {
    translation: 'мы',
    pronunciation: '/wiː/',
    note: 'Говорящий вместе с другими участниками. We are ready — «Мы готовы».',
    audioPending: true,
  },
  They: {
    translation: 'они',
    pronunciation: '/ðeɪ/',
    note: 'В этой главе — другая группа, о которой говорят. They are robots — «Они роботы».',
    audioPending: true,
  },
  "We're": {
    translation: 'мы — сокращение we are',
    pronunciation: 'UK /wɪə/',
    note: 'We’re ready = We are ready. В положительном коротком ответе без продолжения используем Yes, we are.',
    audioPending: true,
  },
  "They're": {
    translation: 'они — сокращение they are',
    pronunciation: 'UK /ðeə/',
    note: 'They’re ready = They are ready. They’re not ready = They are not ready.',
    audioPending: true,
  },
  ready: {
    translation: 'готов / готова / готовы',
    pronunciation: '/ˈred.i/',
    note: 'Прилагательное. В этой главе — готовность к отправлению, подтверждённая собранным багажом. Написание не меняется во множественном числе.',
    audioPending: true,
  },
  not: {
    translation: 'не',
    pronunciation: 'UK /nɒt/',
    note: 'В отрицании с be ставим после am/is/are: I am not ready. Слова описывают факт, а не меняют его.',
    audioPending: true,
  },
  "isn't": {
    translation: 'сокращение is not',
    pronunciation: '/ˈɪz.ənt/',
    note: 'He isn’t ready = He is not ready = He’s not ready. Разные сокращения с тем же смыслом.',
    audioPending: true,
  },
  "aren't": {
    translation: 'сокращение are not',
    pronunciation: 'UK /ɑːnt/',
    note: 'They aren’t ready = They are not ready = They’re not ready.',
    audioPending: true,
  },
  Yes: {
    translation: 'да',
    pronunciation: '/jes/',
    note: 'Положительный короткий ответ: Yes, I am / Yes, we are / Yes, he is. В нём be оставляем целиком.',
    audioPending: true,
  },
  "I'm": {
    translation: 'я — сокращение I am',
    pronunciation: '/aɪm/',
    note: 'Та же конструкция I am, записанная короче. Апостроф заменяет a из am. I’m Lumi = I am Lumi.',
    audioPending: true,
  },
  "You're": {
    translation: 'ты / вы — сокращение you are',
    pronunciation: '/jʊə/, /jɔː/',
    note: 'You’re = you are. Смысл и собеседник остаются теми же. Апостроф заменяет a из are.',
    audioPending: true,
  },
  "He's": {
    translation: 'он — здесь сокращение he is',
    pronunciation: '/hiːz/',
    note: 'В заданиях этой главы he’s = he is. Это не новое местоимение. В других конструкциях ’s бывает сокращением has.',
    audioPending: true,
  },
  "She's": {
    translation: 'она — здесь сокращение she is',
    pronunciation: '/ʃiːz/',
    note: 'В заданиях этой главы she’s = she is. В других конструкциях ’s бывает сокращением has.',
    audioPending: true,
  },
  "It's": {
    translation: 'это / он / она / оно — здесь сокращение it is',
    pronunciation: '/ɪts/',
    note: 'В заданиях этой главы it’s = it is. Апостроф заменяет i. Не путай с its без апострофа — это другая конструкция, её изучим позже.',
    audioPending: true,
  },
  two: {
    translation: 'два / две',
    pronunciation: '/tuː/',
    note: 'Числительное. Two robots — два робота. После two нужно множественное число существительного.',
    audioPending: true,
  },
  robots: {
    translation: 'роботы',
    pronunciation: 'UK /ˈrəʊ.bɒts/',
    note: 'Множественное число от robot: добавляем -s. Two robots — два робота; a/an перед robots не ставим.',
    image: 'props/robot-v1.png',
    audioPending: true,
  },
  books: {
    translation: 'книги',
    pronunciation: '/bʊks/',
    note: 'Множественное число от book: добавляем -s. Two books — две книги.',
    image: 'props/book-v1.png',
    audioPending: true,
  },
  keys: {
    translation: 'ключи',
    pronunciation: '/kiːz/',
    note: 'Множественное число от key. Перед y гласная e, поэтому y сохраняется: keys.',
    image: 'lantern-and-moss/key-v1.png',
    audioPending: true,
  },
  box: {
    translation: 'ящик / коробка',
    pronunciation: 'UK /bɒks/',
    note: 'Один ящик: a box. Множественное число — boxes, после x добавляем -es.',
    audioPending: true,
  },
  boxes: {
    translation: 'ящики / коробки',
    pronunciation: 'UK /ˈbɒk.sɪz/',
    note: 'Множественное число от box: box + es. Two boxes — два ящика.',
    audioPending: true,
  },
  story: {
    translation: 'рассказ / история',
    pronunciation: 'UK /ˈstɔː.ri/',
    note: 'Здесь один рассказ. Перед конечной y согласная r: story → stories.',
    audioPending: true,
  },
  stories: {
    translation: 'рассказы / истории',
    pronunciation: 'UK /ˈstɔː.riz/',
    note: 'Множественное число от story: согласная + y меняется на ies. Two stories — два рассказа.',
    audioPending: true,
  },
  child: {
    translation: 'ребёнок',
    pronunciation: '/tʃaɪld/',
    note: 'Один ребёнок: a child. Особая форма множественного числа — children.',
    audioPending: true,
  },
  children: {
    translation: 'дети',
    pronunciation: '/ˈtʃɪl.drən/',
    note: 'Множественное число от child. Two children — два ребёнка. Дополнительное s не нужно.',
    audioPending: true,
  },
  person: {
    translation: 'человек',
    pronunciation: 'UK /ˈpɜː.sən/',
    note: 'Один человек: a person. Для обычного обозначения нескольких людей используем people.',
    audioPending: true,
  },
  people: {
    translation: 'люди',
    pronunciation: '/ˈpiː.pəl/',
    note: 'В этой главе множественное число от person: two people — два человека. Persons встречается в официальной речи.',
    audioPending: true,
  },
  It: {
    translation: 'он / она / оно / это — о предмете',
    pronunciation: '/ɪt/',
    note: 'Здесь личное местоимение для одного обычного предмета, о котором понятно, что речь именно о нём. It is an umbrella — «Это зонт». Род русского слова не определяет выбор; это не универсальное правило для всех животных и одушевлённых героев.',
  },
  He: {
    translation: 'он',
    pronunciation: '/hiː/, /hi/',
    note: 'Личное местоимение: тот, о ком говорят. О Тике в нашей истории говорим he. He is a robot — «Он робот». Это не правило для любого робота.',
  },
  She: {
    translation: 'она',
    pronunciation: '/ʃiː/, /ʃi/',
    note: 'Личное местоимение: та, о ком говорят. She is Marta — «Она Марта». Выбор зависит от того, о ком сообщение, а не от автора.',
  },
  You: {
    translation: 'ты / вы',
    pronunciation: '/juː/, /jə/',
    note: 'Личное местоимение: тот или те, к кому обращаются. You are Lumi — «Ты Люми». В начале предложения пишется с большой буквы; внутри обычно you.',
  },
  are: {
    translation: 'форма be с you',
    pronunciation: 'UK /ɑː/, /ə/',
    note: 'С you нужна are, даже когда собеседник один. You are a robot — «Ты робот». Позже эта форма встретится с we и they.',
  },
  lantern: {
    translation: 'фонарь',
    pronunciation: 'UK /ˈlæn.tən/',
    note: 'Один фонарь. I am a lantern — «Я фонарь»: описание, а не имя. Первый звук согласный, поэтому a.',
  },
  I: {
    translation: 'я',
    pronunciation: '/aɪ/',
    note: 'Личное местоимение: тот, кто говорит. Всегда с большой буквы. I am Lumi — «Я Люми».',
  },
  am: {
    translation: 'форма be с I',
    pronunciation: '/æm/, /əm/',
    note: 'I am — «я есть / я являюсь». В русском «есть» часто пропускают; в I am Lumi слово am нужно.',
  },
  is: {
    translation: 'форма глагола be',
    pronunciation: '/ɪz/',
    note: 'С he, she и it нужна форма is: She is Marta — «Она Марта»; It is an egg — «Это яйцо». С I используем am, с you — are.',
  },
  Lumi: {
    translation: 'Люми',
    pronunciation: '/ˈluː.mi/',
    note: 'Имя живого фонаря. I am Lumi — «Я Люми». Перед именем артикль не нужен.',
  },
  Marta: {
    translation: 'Марта',
    pronunciation: '/ˈmɑː.tə/',
    note: 'Имя хозяйки мастерской. I am Marta — «Я Марта».',
    audioPending: true,
  },
  apples: {
    translation: 'яблоки',
    pronunciation: '/ˈæp.əlz/',
    note: 'Множественное число от apple. A/an не ставим; the apples — конкретные яблоки.',
    image: 'props/apple-v1.png',
  },
  eggs: {
    translation: 'яйца',
    pronunciation: '/eɡz/',
    note: 'Множественное число от egg. A/an не ставим; the eggs — конкретные яйца.',
    image: 'props/egg-v1.png',
  },
  cat: {
    translation: 'кот / кошка',
    pronunciation: '/kæt/',
    note: 'Один кот или одна кошка. Первый звук /k/ — согласный.',
    image: 'lumi/cat-v1.png',
  },
  key: {
    translation: 'ключ',
    pronunciation: '/kiː/',
    note: 'Один ключ. Первый звук /k/ — согласный.',
    image: 'lantern-and-moss/key-v1.png',
  },
  apple: {
    translation: 'яблоко',
    pronunciation: '/ˈæp.əl/',
    note: 'Один плод. Первый звук /æ/ — гласный.',
    image: 'props/apple-v1.png',
  },
  egg: {
    translation: 'яйцо',
    pronunciation: '/eɡ/',
    note: 'Одно яйцо. Первый звук /e/ — гласный.',
    image: 'props/egg-v1.png',
  },
  book: {
    translation: 'книга',
    pronunciation: '/bʊk/',
    note: 'Одна книга. Первый звук /b/ — согласный.',
    image: 'props/book-v1.png',
  },
  orange: {
    translation: 'апельсин',
    pronunciation: 'UK /ˈɒr.ɪndʒ/',
    note: 'Здесь плод, а не цвет. Первый звук — гласный; произношение UK и US различается.',
    image: 'props/orange-v1.png',
  },
  robot: {
    translation: 'робот',
    pronunciation: 'UK /ˈrəʊ.bɒt/',
    note: 'Один робот-помощник. Первый звук /r/ — согласный.',
    image: 'props/robot-v1.png',
  },
  umbrella: {
    translation: 'зонт',
    pronunciation: '/ʌmˈbrel.ə/',
    note: 'Один зонт. Первый звук /ʌ/ — гласный, независимо от буквы u.',
    image: 'props/umbrella-v1.png',
  },
  a: {
    translation: 'неопределённый артикль перед согласным звуком',
    pronunciation: '/ə/, отдельно /eɪ/',
    note: articleNotes.a,
  },
  an: {
    translation: 'неопределённый артикль перед гласным звуком',
    pronunciation: '/ən/, отдельно /æn/',
    note: articleNotes.an,
  },
  the: {
    translation: 'определённый артикль',
    pronunciation: '/ðə/, /ðiː/',
    note: articleNotes.the,
  },
} as const;
export type WordId = keyof typeof wordbook;
export function isWordId(word: string): word is WordId {
  return Object.hasOwn(wordbook, word);
}
export function roomWords(room: Room): WordId[] {
  return [
    ...new Set(
      room.pieces.flatMap((p) =>
        p.kind === 'word' &&
        isWordId(p.word) &&
        !Object.hasOwn(articleNotes, p.word)
          ? [p.word]
          : [],
      ),
    ),
  ];
}
// Authored registry, not the player's discovered dictionary.
export const allWords = Object.keys(wordbook).filter(isWordId).sort();
export function roomTerms(room: Room): WordId[] {
  return [
    ...roomWords(room),
    ...new Set(
      room.pieces.flatMap((piece) =>
        piece.kind === 'word' &&
        isWordId(piece.word) &&
        Object.hasOwn(articleNotes, piece.word)
          ? [piece.word]
          : [],
      ),
    ),
  ];
}
