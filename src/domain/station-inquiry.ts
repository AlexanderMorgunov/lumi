import type { Evaluation } from './puzzle';

// An authored exchange on a passenger card. The narrator may read another
// person's message; its author and addressee remain explicit in the UI.
export type InquiryContext = {
  accepted: readonly (readonly string[])[];
  reply: string;
  authorLabel?: string;
  before: string;
  mismatch: string;
};

export function inquiryMeaning(
  context: InquiryContext,
  words: readonly string[],
): Evaluation {
  const goal = context.accepted.some(
    (answer) =>
      answer.length === words.length && answer.every((w, i) => w === words[i]),
  );
  return {
    form: 'valid',
    inReadingFrame: true,
    goal,
    ...(goal ? {} : { explanation: context.mismatch }),
  };
}
