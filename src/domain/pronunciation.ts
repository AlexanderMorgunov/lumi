export const recordedTerms = [
  'a',
  'am',
  'an',
  'apple',
  'apples',
  'be',
  'book',
  'cat',
  'cats',
  'egg',
  'eggs',
  'i',
  'key',
  'lumi',
  'orange',
  'robot',
  'the',
  'to',
  'umbrella',
  'water',
] as const;
const extraRecordings: Record<string, { file: string; voice: string }> = {
  it: {
    file: 'audio/en-US/elevenlabs-tik-v1/it.mp3',
    voice: 'en · Тик, Will · ElevenLabs v3',
  },
  he: {
    file: 'audio/en-US/elevenlabs-marta-v1/he.mp3',
    voice: 'en · Марта, Matilda · ElevenLabs v3',
  },
  she: {
    file: 'audio/en-US/elevenlabs-tik-v1/she.mp3',
    voice: 'en · Тик, Will · ElevenLabs v3',
  },
  is: {
    file: 'audio/en-US/elevenlabs-tik-v1/is.mp3',
    voice: 'en · Тик, Will · ElevenLabs v3',
  },
  you: {
    file: 'audio/en-US/elevenlabs-marta-v1/you.mp3',
    voice: 'en · Марта, Matilda · ElevenLabs v3',
  },
  are: {
    file: 'audio/en-US/elevenlabs-marta-v1/are.mp3',
    voice: 'en · Марта, Matilda · ElevenLabs v3',
  },
  lantern: {
    file: 'audio/en-US/elevenlabs-marta-v1/lantern.mp3',
    voice: 'en · Марта, Matilda · ElevenLabs v3',
  },
};
const supported = new Set<string>([
  ...recordedTerms,
  ...Object.keys(extraRecordings),
]);
export function recordedTerm(text: string): string | null {
  const term = text.toLowerCase();
  return supported.has(term) ? term : null;
}
export function pronunciationRecording(text: string) {
  const term = recordedTerm(text);
  if (!term) return null;
  return (
    extraRecordings[term] ?? {
      file: `audio/en-US/lessac-v1/${term}.wav`,
      voice: 'en-US · Lessac, синтезированная запись Piper',
    }
  );
}

// Preserve all text, including IPA. A phonetic /k/ is not the letter name "kay".
export function pronunciationParts(text: string) {
  const parts: { text: string; term: string | null }[] = [];
  const pattern =
    /((?<![A-Za-z])\/[^/\nА-Яа-я]+\/)|([A-Za-z]+(?:['’-][A-Za-z]+)*)/g;
  let end = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > end)
      parts.push({ text: text.slice(end, match.index), term: null });
    parts.push({
      text: match[0],
      term: match[1] ? null : recordedTerm(match[0]),
    });
    end = match.index + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), term: null });
  return parts;
}
