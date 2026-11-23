import type { MessageContext, ParticipantId } from './station-chapter';
import type { Evaluation } from './puzzle';
import type { LevelDefinition } from './levels';
import { inquiryMeaning, type InquiryContext } from './station-inquiry';

export type Member = ParticipantId | 'porter-a' | 'porter-b';
export type ExchangeContext = {
  act: 'statement' | 'question' | 'short-answer';
  focus: readonly Member[];
  focusLabel: string;
  addressees: readonly Member[];
  audienceLabel: string;
  selfGroup: readonly Member[];
  thirdGroup: readonly Member[];
  predicate: 'ready' | 'robots';
  ready: boolean;
  evidence: string;
  question?: string;
  inquiry?: InquiryContext;
};

const shortForms: Readonly<Record<string, readonly string[]>> = {
  "I'm": ['I', 'am'],
  "You're": ['You', 'are'],
  "He's": ['He', 'is'],
  "She's": ['She', 'is'],
  "It's": ['It', 'is'],
  "We're": ['We', 'are'],
  "They're": ['They', 'are'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
};
export function expandExchange(words: readonly string[]) {
  return words.flatMap((word) =>
    Object.hasOwn(shortForms, word) ? shortForms[word]! : [word],
  );
}
type Subject =
  'I' | 'You' | 'We' | 'They' | 'He' | 'She' | 'It' | 'robot' | 'robots';
type Utterance = {
  act: ExchangeContext['act'];
  subject: Subject;
  predicate?: 'ready' | 'robots';
  positive: boolean;
};
const subjects: readonly Subject[] = [
  'I',
  'You',
  'We',
  'They',
  'He',
  'She',
  'It',
];
const be = (subject: Subject) =>
  subject === 'I'
    ? 'am'
    : ['You', 'We', 'They', 'robots'].includes(subject)
      ? 'are'
      : 'is';
function parse(words: readonly string[]): Utterance | null {
  let rest = [...words];
  let act: Utterance['act'] = 'statement';
  const answer = rest[0];
  if (rest[0] === 'Yes' || rest[0] === 'No') {
    act = 'short-answer';
    rest = rest.slice(1);
  } else if (['am', 'is', 'are'].includes(rest[0] ?? '')) {
    act = 'question';
    rest = [rest[1]!, rest[0]!, ...rest.slice(2)];
  }
  let subject: Subject;
  if (rest[0] === 'the' && (rest[1] === 'robot' || rest[1] === 'robots')) {
    subject = rest[1];
    rest = [subject, ...rest.slice(2)];
  } else if (subjects.includes(rest[0] as Subject))
    subject = rest[0] as Subject;
  else return null;
  if (rest[1] !== be(subject)) return null;
  rest = rest.slice(2);
  const positive = rest[0] !== 'not';
  if (!positive) rest = rest.slice(1);
  if (act === 'short-answer' && (answer === 'Yes') !== positive) return null;
  if (!rest.length && act === 'short-answer') return { act, subject, positive };
  if (rest.length !== 1 || (rest[0] !== 'ready' && rest[0] !== 'robots'))
    return null;
  return { act, subject, predicate: rest[0], positive };
}

export function exchangeForm(
  level: LevelDefinition,
  raw: readonly string[],
): Evaluation {
  const base = { inReadingFrame: true, goal: false };
  if (!raw.length || raw.some((word) => !word))
    return { ...base, form: 'incomplete' };
  if (raw[0] === 'Yes' && Object.hasOwn(shortForms, raw.at(-1)!))
    return {
      ...base,
      form: 'agreement',
      explanation:
        'В положительном коротком ответе форму be не сокращаем: Yes, I am; Yes, we are; Yes, he is. После неё здесь нет продолжения.',
    };
  const words = expandExchange(raw);
  if (
    level.answers.some(
      (answer) =>
        answer.words.length === words.length &&
        answer.words.every((w, i) => w === words[i]),
    )
  )
    return { ...base, form: 'valid', goal: true };
  if (
    level.answers.some(
      (answer) =>
        answer.words.length > words.length &&
        words.every((word, i) => word === answer.words[i]),
    )
  )
    return { ...base, form: 'incomplete' };
  if (words.includes('readys'))
    return {
      ...base,
      form: 'agreement',
      explanation:
        'Ready — прилагательное «готовый», а не название предмета. Оно не меняется во множественном числе: We are ready.',
    };
  if (level.message?.exchange?.inquiry)
    return {
      ...base,
      form: 'mismatch',
      explanation:
        'Эта запись не подходит к заданию. Проверь вопросительное слово, форму be и порядок слов. Пример есть в журнале и в подсказке.',
    };
  if (!parse(words))
    return {
      ...base,
      form: 'agreement',
      explanation:
        'Проверь форму и порядок: I am; you/we/they are; he/she is. В отрицании not идёт после be. В нейтральном вопросе be стоит перед местоимением.',
    };
  return {
    ...base,
    form: 'mismatch',
    explanation:
      'Такая конструкция возможна, но в этой части нужна запись из задания. Проверь, что именно нужно сообщить или спросить.',
  };
}
const equalGroup = (a: readonly Member[], b: readonly Member[]) =>
  a.length === b.length && a.every((id) => b.includes(id));
export function exchangeMeaning(
  message: MessageContext,
  words: readonly string[],
): Evaluation {
  const base = { form: 'valid' as const, inReadingFrame: true, goal: false };
  const context = message.exchange;
  if (context?.inquiry) return inquiryMeaning(context.inquiry, words);
  const phrase = parse(words);
  if (!context || !phrase) return base;
  if (phrase.act !== context.act)
    return {
      ...base,
      explanation:
        context.act === 'question'
          ? 'Это сообщение, а сейчас нужно узнать ответ. Собери нейтральный вопрос: форма be перед местоимением. Порядок You are ready? возможен как переспрос, но здесь тренируем Are you ready?'
          : 'Форма возможна, но сейчас нужен ответ или сообщение по заданию, а не другой тип реплики.',
    };
  const referents: Record<Subject, readonly Member[]> = {
    I: [message.speaker],
    You: context.addressees,
    We: context.selfGroup,
    They: context.thirdGroup,
    He: ['tik'],
    She: ['marta'],
    It: [],
    robot: ['porter-a'],
    robots: ['porter-a', 'porter-b'],
  };
  if (
    (phrase.subject === 'He' || phrase.subject === 'She') &&
    referents[phrase.subject].some(
      (id) => id === message.speaker || context.addressees.includes(id),
    )
  )
    return {
      ...base,
      explanation:
        'Здесь герой сам говорит или является адресатом. О себе нужно I, при прямом обращении — you. He/she в этих заданиях обозначают другого участника разговора.',
    };
  if (!equalGroup(referents[phrase.subject], context.focus))
    return {
      ...base,
      explanation: `Фраза построена верно, но относится к другим участникам. Сейчас речь о группе или герое «${context.focusLabel}». We включает автора, you — адресата или адресатов, they — другую группу.`,
    };
  if (context.act === 'short-answer' && phrase.predicate)
    return {
      ...base,
      explanation:
        'Это правильный полный ответ. Здесь нужен короткий: Yes + местоимение + am/is/are или No + местоимение + am/is/are + not, без повторения ready.',
    };
  if (context.act !== 'short-answer' && phrase.predicate !== context.predicate)
    return {
      ...base,
      explanation:
        'Предложение построено верно, но сообщает о другом. Проверь задачу: назвать вид участников или их готовность.',
    };
  if (context.act === 'question') return { ...base, goal: true };
  const fact =
    context.predicate === 'ready'
      ? context.ready
      : context.focus.every((id) =>
          ['tik', 'porter-a', 'porter-b'].includes(id),
        );
  if (phrase.positive !== fact)
    return {
      ...base,
      explanation: `Форма верная, но сообщение не совпадает с фактом: ${context.evidence}. Слова не собирают багаж и не меняют готовность.`,
    };
  return { ...base, goal: true };
}

export function exchangeReply(context: ExchangeContext) {
  if (context.inquiry) return context.inquiry.reply;
  const adjective =
    context.focus.length > 1
      ? 'готовы'
      : context.focus[0] === 'marta'
        ? 'готова'
        : 'готов';
  return `${context.ready ? `Да, ${adjective}` : `Нет, пока не ${adjective}`}. ${context.evidence}.`;
}
export function exchangeStatus(context: ExchangeContext, completed: boolean) {
  if (context.inquiry)
    return completed ? context.inquiry.reply : context.inquiry.before;
  if (context.act === 'question')
    return completed
      ? exchangeReply(context)
      : `${context.focusLabel} · ответ ещё не получен`;
  return `${context.focusLabel} · ${context.evidence}`;
}
// Capitalisation and punctuation belong to the readable sentence, not extra tiles.
export function exchangeText(words: readonly string[]) {
  return words
    .map((word, i) => {
      if (!word) return '…';
      if (word === 'Yes' || word === 'No') return `${word},`;
      if (['Lumi', 'Marta', 'Tik', 'Nora'].includes(word)) return word;
      if (word === 'I' || word === "I'm") return word;
      return i === 0
        ? word[0]!.toUpperCase() + word.slice(1)
        : word.toLowerCase();
    })
    .join(' ');
}
