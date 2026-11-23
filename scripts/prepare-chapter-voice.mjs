// Extract the displayed dialogue from the same pure data used by React.
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const spokenOverrides = {
  'chapter-01-02-task-01':
    'Следующее слово — key, ключ от замка. Послушай: key. Первый звук — согласный. Key называет один ключ.',
  'chapter-01-03-task-02':
    'Нажми apple и послушай произношение. Первый звук — гласный. Apple называет одно яблоко; его можно посчитать. Значит, это исчисляемое существительное в единственном числе.',
  'chapter-01-04-task-02':
    'Нажми egg и послушай произношение. Первый звук — гласный. Выбери между a и an, как в просьбе с яблоком.',
  'chapter-01-9-1-task-02':
    'Apple — яблоко. Начинается с гласного звука. Попроси одно любое яблоко и запомни, какое яблоко я отложу.',
  'chapter-01-9-2-feedback-chain-sound':
    'Первый звук в apple не изменился. Изменилась ситуация: одно яблоко стало известно обоим. Поэтому the apple вместо просьбы о любом плоде.',
  'chapter-01-10-1-task-01':
    'Book — книга. Первый звук — согласный. Книги можно посчитать; здесь book означает одну книгу.',
  'chapter-01-11-1-task-01':
    'Robot — робот. Первый звук — согласный. Роботов можно посчитать; robot здесь — один робот.',
  'chapter-01-11-3-task-01':
    'Umbrella — зонт. Первый звук — гласный: an umbrella. Выбираем по звуку, а не по букве u.',
};

function spokenLine(line) {
  const text = (spokenOverrides[line.id] ?? line.sourceText)
    .replaceAll('A/an', 'Артикли a и an')
    .replaceAll('a/an', 'a и an')
    .replace(/первый звук \/[^/]+\/ —/gi, 'первый звук —')
    .replace(/гласным \/[^/]+\//g, 'гласным звуком')
    .replace(/согласным \/[^/]+\//g, 'согласным звуком')
    .replace(/гласного \/[^/]+\//g, 'гласного звука')
    .replace(/согласного \/[^/]+\//g, 'согласного звука')
    .replace(/гласный \/[^/]+\//g, 'гласный звук')
    .replace(/согласный \/[^/]+\//g, 'согласный звук')
    .replace(/(звука|звуком|звук) \/[^/]+\//g, '$1');
  if (text.includes('/')) throw new Error(`Unadapted notation: ${line.id}`);
  return (
    (line.conversation === 'success' && line.index === 0
      ? '[pleased] '
      : '[reassuring] ') + text
  );
}

const server = await createServer({
  configFile: false,
  cacheDir: 'artifacts/voice/vite-cache',
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { levels } = await server.ssrLoadModule('/src/domain/levels.ts');
  const { nextEpisodes, reflections } = await server.ssrLoadModule(
    '/src/domain/episodes.ts',
  );
  const { dialogueStory, dialogueVoiceLine } = await server.ssrLoadModule(
    '/src/domain/dialogue.ts',
  );
  const lines = [];
  for (
    let episode = nextEpisodes.cat;
    episode;
    episode = nextEpisodes[episode]
  ) {
    for (
      let definition = levels[episode];
      definition;
      definition = definition.continuation
    ) {
      const room = { episode, definition, explanations: [] };
      for (const conversation of ['task', 'success']) {
        dialogueStory(room, conversation).lines.forEach((_, index) => {
          const line = dialogueVoiceLine(room, conversation, index);
          lines.push({
            id: line.id,
            episode,
            levelId: definition.id,
            conversation,
            index,
            sourceText: line.text,
          });
        });
      }
      if (!definition.continuation) {
        for (const choice of reflections[episode].choices) {
          const index = dialogueStory(room, 'success').lines.length - 1;
          const line = dialogueVoiceLine(
            { ...room, explanations: [choice.id] },
            'success',
            index,
          );
          lines.push({
            id: line.id,
            episode,
            levelId: definition.id,
            conversation: 'feedback',
            choice: choice.id,
            sourceText: line.text,
          });
        }
      }
    }
  }
  const script = {
    provider: 'elevenlabs',
    voice: 'Callum',
    voiceId: 'N2lVS1w4EtoT3dr4eOWO',
    modelId: 'eleven_v3',
    seed: 42,
    lines: lines.map((line) => ({ ...line, spokenText: spokenLine(line) })),
  };
  if (new Set(lines.map((line) => line.id)).size !== lines.length)
    throw new Error('Duplicate voice line IDs');
  await writeFile(
    'docs/voice/chapter-01-rest-script.json',
    JSON.stringify(script, null, 2) + '\n',
  );
  const groups = {};
  for (const line of script.lines) {
    groups[line.episode] ??= { lines: 0, characters: 0 };
    groups[line.episode].lines++;
    groups[line.episode].characters += line.spokenText.length;
  }
  console.log(
    JSON.stringify(
      {
        lines: lines.length,
        characters: script.lines.reduce(
          (sum, line) => sum + line.spokenText.length,
          0,
        ),
        groups,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}
