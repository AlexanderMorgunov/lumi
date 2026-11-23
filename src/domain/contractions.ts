const contractions: Readonly<Record<string, readonly string[]>> = {
  "I'm": ['I', 'am'],
  "You're": ['You', 'are'],
  "He's": ['He', 'is'],
  "She's": ['She', 'is'],
  "It's": ['It', 'is'],
};

export function isContraction(word: string) {
  return Object.hasOwn(contractions, word);
}

// Only authored affirmative be lessons opt into this equivalence.
export function expandContraction(words: readonly string[]): string[] {
  const first = words[0];
  return first && isContraction(first)
    ? [...contractions[first]!, ...words.slice(1)]
    : [...words];
}
