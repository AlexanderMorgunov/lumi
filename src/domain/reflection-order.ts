// Keep answer identity and order stable during replay, but remove the first-choice bias.
export function reflectionOrder<T extends { id: string }>(
  episode: string,
  choices: readonly T[],
  correct: string,
): readonly T[] {
  const match = /^chapter-02-(\d+)$/.exec(episode);
  if (!match || choices.length < 2) return choices;
  const index = choices.findIndex((choice) => choice.id === correct);
  if (index < 0) return choices;
  const target = (Number(match[1]) - 1) % choices.length;
  const offset = (index - target + choices.length) % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}
