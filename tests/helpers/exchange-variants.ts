// Surface forms exercised through the same push controls as full sentences.
export function exchangeVariants(words: readonly string[]) {
  const variants = [[...words]];
  const pairs: Readonly<Record<string, string>> = {
    'I am': "I'm",
    'You are': "You're",
    'We are': "We're",
    'They are': "They're",
    'He is': "He's",
    'She is': "She's",
    'It is': "It's",
    'is not': "isn't",
    'are not': "aren't",
  };
  for (let i = 0; i < words.length - 1; i++) {
    const short = pairs[`${words[i]} ${words[i + 1]}`];
    if (short)
      variants.push([...words.slice(0, i), short, ...words.slice(i + 2)]);
  }
  return variants;
}
