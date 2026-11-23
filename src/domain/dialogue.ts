import { firstLesson } from './first-lesson';
import { firstDialogue } from './first-dialogue';
import {
  keyIntroduction,
  appleLesson,
  eggIntroduction,
  choiceStories,
  theLesson,
  theAppleIntroduction,
  reflections,
} from './episodes';
import type { PuzzleState } from './puzzle';
import type { DialogueSpeaker } from './levels';

export type Conversation = 'meet' | 'rule' | 'task' | 'success';
export function dialogueSpeaker(
  room: Pick<PuzzleState, 'definition'>,
  conversation: Conversation | null,
  index: number,
): DialogueSpeaker {
  if (conversation === 'task' || conversation === 'success')
    return (
      room.definition.presentation?.speakers?.[conversation][index] ??
      (room.definition.message ? 'tik' : 'cat')
    );
  return room.definition.message ? 'tik' : 'cat';
}
type DialogueRoom = Pick<
  PuzzleState,
  'episode' | 'definition' | 'explanations'
>;
const conversations = {
  ...firstDialogue,
  rule: {
    ...firstDialogue.rule,
    lines: [
      ...firstDialogue.rule.lines,
      ...firstLesson.map((part) => part.text),
    ],
  },
  task: {
    title: 'Ключ в дорогу',
    lines: keyIntroduction,
    action: 'Начать просьбу',
  },
};
const keySuccess = {
  title: 'Ключ в дорожной сумке',
  lines: [
    'Ключ в сумке. Два других оставим здесь.',
    'Что означает a key в нашей просьбе?',
  ],
  action: 'В мастерскую',
};
const appleTask = {
  title: 'Яблоко для Марты',
  lines: appleLesson.map((part) => part.text),
  action: 'Собрать просьбу',
};
const appleSuccess = {
  title: 'Перекус в дорогу',
  lines: [
    'Яблоко в сумке. Марта сможет перекусить у первого огня.',
    'Почему в просьбе an apple используется an, а не a?',
  ],
  action: 'В мастерскую',
};

const taskStories = {
  theApple: {
    title: 'Подарок смотрителю',
    lines: theAppleIntroduction,
    action: 'Начать просьбу',
  },
  theKey: {
    title: 'Ключ от мастерской',
    lines: theLesson.map((part) => part.text),
    action: 'Собрать просьбу',
  },
  ...choiceStories,
  key: conversations.task,
  apple: appleTask,
  egg: {
    title: 'Запас для привала',
    lines: eggIntroduction,
    action: 'Начать просьбу',
  },
};
const successStories = {
  theApple: {
    title: 'Подарок для первого огня',
    lines: [
      'Зелёное яблоко в сумке — подарок смотрителю готов. Два красных оставим Марте.',
      'Почему здесь the apple, хотя apple начинается с гласного звука?',
    ],
    action: 'В мастерскую',
  },
  theKey: {
    title: 'Ключ от двери у Марты',
    lines: [
      'Вот ключ от двери. Марта закроет мастерскую, а ключи от шкафа и сундука оставит дома.',
      'Почему в этой просьбе нужен the, а не a?',
    ],
    action: 'В мастерскую',
  },
  choiceKey: {
    title: 'Ключ для помощника',
    lines: [
      'Один ключ уже во второй сумке, два остались на столе. Следом возьмём яблоко. Сначала объясним выбор: почему здесь a key?',
    ],
    action: 'В мастерскую',
  },
  choiceApple: {
    title: 'Можно отправляться',
    lines: [
      'Яблоко и ключ уже в сумке помощника. С припасами закончили; дальше понадобится конкретный ключ — от двери мастерской.',
      'В одной просьбе мы собрали a key, в другой — an apple. Почему во второй просьбе форма артикля изменилась?',
    ],
    action: 'В мастерскую',
  },
  key: keySuccess,
  apple: appleSuccess,
  egg: {
    title: 'Запас собран',
    lines: [
      'Яйцо в сумке — на привале будет чем перекусить. Два других оставим здесь.',
      'Как объяснить просьбу an egg в этой ситуации?',
    ],
    action: 'В мастерскую',
  },
};

export function dialogueStory(
  room: Pick<DialogueRoom, 'episode' | 'definition'>,
  conversation: Conversation,
) {
  const authored = room.definition.presentation;
  if (authored && (conversation === 'task' || conversation === 'success'))
    return {
      title: authored.title,
      lines: conversation === 'task' ? authored.introduction : authored.success,
      action: room.definition.message
        ? conversation === 'task'
          ? room.definition.message.intent === 'label-group'
            ? 'Собрать подпись'
            : room.definition.message.exchange?.act === 'question'
              ? 'Собрать вопрос'
              : room.definition.message.exchange?.act === 'short-answer'
                ? 'Собрать ответ'
                : 'Собрать сообщение'
          : 'На станцию'
        : conversation === 'task'
          ? 'Начать просьбу'
          : 'В мастерскую',
    };
  if (
    conversation === 'task' &&
    room.episode !== 'cat' &&
    room.episode in taskStories
  )
    return taskStories[room.episode as keyof typeof taskStories];
  if (
    conversation === 'success' &&
    room.episode !== 'cat' &&
    room.episode in successStories
  )
    return successStories[room.episode as keyof typeof successStories];
  return conversations[conversation];
}

export function dialogueVoiceLine(
  room: DialogueRoom,
  conversation: Conversation | null,
  index: number,
) {
  if (!conversation) return undefined;
  const story = dialogueStory(room, conversation);
  const text = story.lines[index];
  if (!text) return undefined;
  const prefix =
    room.episode === 'cat' ? 'ep01' : room.definition.id.toLowerCase();
  if (
    conversation === 'success' &&
    index === story.lines.length - 1 &&
    room.episode !== 'cat' &&
    !room.definition.continuation
  ) {
    const answer = room.explanations.at(-1);
    const feedback = reflections[room.episode].choices.find(
      (choice) => choice.id === answer,
    );
    if (feedback)
      return {
        id: prefix + '-feedback-' + feedback.id,
        text: feedback.feedback,
      };
  }
  return {
    id: prefix + '-' + conversation + '-' + String(index + 1).padStart(2, '0'),
    text,
  };
}
