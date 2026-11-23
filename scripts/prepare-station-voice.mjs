// Authoring only: extract exact current dialogue without calling a speech API.
import { writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const episode = process.argv[2] ?? '01';
if (
  ![
    '01',
    '02',
    '03',
    '04',
    '05',
    '06',
    '07',
    '08',
    '09',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
  ].includes(episode) ||
  process.argv.length > 3
)
  throw new Error('Usage: node scripts/prepare-station-voice.mjs [01..20]');

const server = await createServer({
  configFile: false,
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const next = Number(episode) >= 6;
  const finale = Number(episode) >= 16;
  const departure = Number(episode) >= 11;
  const data = await server.ssrLoadModule(
    finale
      ? '/src/domain/station-finale.ts'
      : departure
        ? '/src/domain/station-departure.ts'
        : next
          ? '/src/domain/station-next.ts'
          : episode === '01'
            ? '/src/domain/station-chapter.ts'
            : episode === '02'
              ? '/src/domain/station-identity.ts'
              : episode === '03'
                ? '/src/domain/station-address.ts'
                : episode === '04'
                  ? '/src/domain/station-third-person.ts'
                  : '/src/domain/station-objects.ts',
  );
  const stationLevel = finale
    ? data.finaleLevels[`chapter-02-${episode}`]
    : departure
      ? data.departureLevels[`chapter-02-${episode}`]
      : next
        ? data.stationNextLevels[`chapter-02-${episode}`]
        : episode === '01'
          ? data.stationLevel
          : episode === '02'
            ? data.stationIdentityLevel
            : episode === '03'
              ? data.stationAddressLevel
              : episode === '04'
                ? data.stationThirdLevel
                : data.stationObjectsLevel;
  const stationEpisode = next
    ? `chapter-02-${episode}`
    : episode === '01'
      ? data.stationEpisode
      : episode === '02'
        ? data.stationIdentityEpisode
        : episode === '03'
          ? data.stationAddressEpisode
          : episode === '04'
            ? data.stationThirdEpisode
            : data.stationObjectsEpisode;
  const stationReflection = finale
    ? data.finaleReflections[`chapter-02-${episode}`]
    : departure
      ? data.departureReflections[`chapter-02-${episode}`]
      : next
        ? data.stationNextReflections[`chapter-02-${episode}`]
        : episode === '01'
          ? data.stationReflection
          : episode === '02'
            ? data.stationIdentityReflection
            : episode === '03'
              ? data.stationAddressReflection
              : episode === '04'
                ? data.stationThirdReflection
                : data.stationObjectsReflection;
  const { dialogueVoiceLine, dialogueSpeaker } = await server.ssrLoadModule(
    '/src/domain/dialogue.ts',
  );
  const lines = [];
  for (
    let definition = stationLevel;
    definition;
    definition = definition.continuation
  ) {
    const room = { episode: stationEpisode, definition, explanations: [] };
    for (const conversation of ['task', 'success']) {
      const texts =
        conversation === 'task'
          ? definition.presentation.introduction
          : definition.presentation.success;
      texts.forEach((_, index) => {
        const speaker = dialogueSpeaker(room, conversation, index);
        if (!['marta', 'tik', 'lumi'].includes(speaker)) return;
        const line = dialogueVoiceLine(room, conversation, index);
        lines.push({
          id: line.id,
          speaker,
          sourceText: line.text,
          spokenText: next
            ? line.text
            : (speaker === 'marta' ? '[warmly] ' : '[friendly] ') + line.text,
        });
      });
    }
    if (!definition.continuation)
      for (const choice of stationReflection.choices) {
        const line = dialogueVoiceLine(
          { ...room, explanations: [choice.id] },
          'success',
          definition.presentation.success.length - 1,
        );
        lines.push({
          id: line.id,
          speaker: next
            ? dialogueSpeaker(
                room,
                'success',
                definition.presentation.success.length - 1,
              )
            : 'tik',
          sourceText: line.text,
          spokenText: next ? line.text : '[reassuring] ' + line.text,
        });
      }
  }
  const script = {
    modelId: 'eleven_v3',
    seed: 42,
    review: next
      ? `edited-source-extracted; owner-authorized-${finale ? '16-20' : departure ? '11-15' : '06-10'}; active-station-elevenlabs-cast`
      : 'source-text-extracted; active-cast-in-character-profiles; legacy-elevenlabs-spoken-tags',
    voices: {
      marta: 'Warm, mature, clear female voice; relaxed natural Russian.',
      tik: 'Light, lively male voice; clear Russian, gentle curiosity, not metallic distortion.',
      lumi: 'Garry; owner-selected gentle young male voice from ElevenLabs library.',
    },
    lines,
  };
  await writeFile(
    `docs/voice/station-${episode}-script.json`,
    JSON.stringify(script, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      lines: lines.length,
      characters: lines.reduce((n, line) => n + line.spokenText.length, 0),
      speakers: [...new Set(lines.map((line) => line.speaker))],
      note: 'No API calls; current source text only.',
    }),
  );
} finally {
  await server.close();
}
