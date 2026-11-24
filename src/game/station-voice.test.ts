import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import scriptOne from '../../tests/fixtures/voice/station-01-script.json';
import scriptTwo from '../../tests/fixtures/voice/station-02-script.json';
import scriptThree from '../../tests/fixtures/voice/station-03-script.json';
import scriptFour from '../../tests/fixtures/voice/station-04-script.json';
import scriptFive from '../../tests/fixtures/voice/station-05-script.json';
import nextPlan from '../../tests/fixtures/voice/station-06-10-elevenlabs-plan.json';
import departurePlan from '../../tests/fixtures/voice/station-11-15-elevenlabs-plan.json';
import finalePlan from '../../tests/fixtures/voice/station-16-20-elevenlabs-plan.json';
import speechRepair from '../../tests/fixtures/voice/station-speech-repair-plan.json';
import reviewPlan from '../../tests/fixtures/voice/chapter-02-review-plan.json';
import bilingualPlan from '../../tests/fixtures/voice/chapter-02-bilingual-plan.json';
import { finaleLevels, finaleReflections } from '../domain/station-finale';
import {
  departureLevels,
  departureReflections,
} from '../domain/station-departure';
import {
  stationNextLevels,
  stationNextReflections,
} from '../domain/station-next';
import type { LevelDefinition } from '../domain/levels';
import planFive from '../../tests/fixtures/voice/station-05-qwen-plan.json';
import {
  stationObjectsLevel,
  stationObjectsEpisode,
  stationObjectsReflection,
} from '../domain/station-objects';
import manifest from './station-voice-manifest.json';
import cast from '../../tests/fixtures/voice/station-elevenlabs-cast.json';
import elevenPlan from '../../tests/fixtures/voice/station-elevenlabs-plan.json';
import repairs from '../../tests/fixtures/voice/station-elevenlabs-patches.json';
import cues from './station-mouth-cues.json';
import planOne from '../../tests/fixtures/voice/station-01-qwen-plan.json';
import planTwo from '../../tests/fixtures/voice/station-02-qwen-plan.json';
import planThree from '../../tests/fixtures/voice/station-03-qwen-plan.json';
import planFour from '../../tests/fixtures/voice/station-04-qwen-plan.json';
import {
  stationThirdLevel,
  stationThirdEpisode,
  stationThirdReflection,
} from '../domain/station-third-person';
import {
  stationAddressLevel,
  stationAddressEpisode,
  stationAddressReflection,
} from '../domain/station-address';
import {
  stationIdentityLevel,
  stationIdentityEpisode,
  stationIdentityReflection,
} from '../domain/station-identity';
import martaVoice from '../../tests/fixtures/voice/marta-voice-profile.json';
import tikVoice from '../../tests/fixtures/voice/tik-voice-profile.json';
import {
  stationLevel,
  stationEpisode,
  stationReflection,
} from '../domain/station-chapter';
import { dialogueSpeaker, dialogueVoiceLine } from '../domain/dialogue';

const script = {
  lines: [
    ...scriptOne.lines,
    ...scriptTwo.lines,
    ...scriptThree.lines,
    ...scriptFour.lines,
    ...scriptFive.lines,
  ],
};
const currentLaterEntries = [
  ...nextPlan.entries,
  ...departurePlan.entries,
  ...finalePlan.entries,
].map(
  (entry) =>
    reviewPlan.entries.find((repair) => repair.id === entry.id) ??
    bilingualPlan.entries.find((repair) => repair.id === entry.id) ??
    speechRepair.entries.find((repair) => repair.id === entry.id) ??
    entry,
);
const qwenPlan = {
  lines: [
    ...planOne.lines,
    ...planTwo.lines,
    ...planThree.lines,
    ...planFour.lines,
    ...planFive.lines,
  ],
  jobs: [
    ...planOne.jobs,
    ...planTwo.jobs,
    ...planThree.jobs,
    ...planFour.jobs,
    ...planFive.jobs,
  ],
};

it('keeps station voice scripts tied to current speakers and exact dialogue, including feedback', () => {
  const expected = [];
  for (const definition of [
    stationLevel,
    stationLevel.continuation!,
    stationIdentityLevel,
    stationIdentityLevel.continuation!,
    stationAddressLevel,
    stationAddressLevel.continuation!,
    stationThirdLevel,
    stationThirdLevel.continuation!,
    stationThirdLevel.continuation!.continuation!,
    stationObjectsLevel,
    stationObjectsLevel.continuation!,
  ]) {
    const identity = definition.id.startsWith(stationIdentityEpisode);
    const address = definition.id.startsWith(stationAddressEpisode);
    const third = definition.id.startsWith(stationThirdEpisode);
    const objects = definition.id.startsWith(stationObjectsEpisode);
    const room = {
      episode: objects
        ? stationObjectsEpisode
        : third
          ? stationThirdEpisode
          : address
            ? stationAddressEpisode
            : identity
              ? stationIdentityEpisode
              : stationEpisode,
      definition,
      explanations: [],
    };
    for (const conversation of ['task', 'success'] as const) {
      const lines =
        conversation === 'task'
          ? definition.presentation!.introduction
          : definition.presentation!.success;
      lines.forEach((_, index) => {
        const speaker = dialogueSpeaker(room, conversation, index);
        if (!['marta', 'tik', 'lumi'].includes(speaker)) return;
        const line = dialogueVoiceLine(room, conversation, index)!;
        expected.push({ id: line.id, speaker, sourceText: line.text });
      });
    }
    if (!definition.continuation)
      for (const choice of (objects
        ? stationObjectsReflection
        : third
          ? stationThirdReflection
          : address
            ? stationAddressReflection
            : identity
              ? stationIdentityReflection
              : stationReflection
      ).choices) {
        const line = dialogueVoiceLine(
          { ...room, explanations: [choice.id] },
          'success',
          definition.presentation!.success.length - 1,
        )!;
        expected.push({ id: line.id, speaker: 'tik', sourceText: line.text });
      }
  }
  expect(
    script.lines.map(({ id, speaker, sourceText }) => ({
      id,
      speaker,
      sourceText,
    })),
  ).toEqual(expected);
});

it('never ships station audio without matching source, checksum and mouth cues', () => {
  const clips: readonly {
    id: string;
    speaker: string;
    sourceText: string;
    file: string;
    audioSha256: string;
    duration: number;
  }[] = manifest.clips;
  const mouthCues: readonly {
    id: string;
    file: string;
    frames: string;
    audioSha256: string;
  }[] = cues.clips;
  expect(mouthCues.length).toBe(clips.length);
  const allLines = [...script.lines, ...currentLaterEntries];
  expect(clips).toHaveLength(allLines.length);
  expect(new Set(clips.map((clip) => clip.id)).size).toBe(allLines.length);
  for (const clip of clips) {
    expect(allLines.find((line) => line.id === clip.id)).toMatchObject({
      sourceText: clip.sourceText,
      speaker: clip.speaker,
    });
    expect(
      createHash('sha256')
        .update(readFileSync('public/' + clip.file))
        .digest('hex'),
    ).toBe(clip.audioSha256);
    const cue = mouthCues.find((item) => item.id === clip.id)!;
    expect(cue.file).toBe(clip.file);
    expect(cue.audioSha256).toBe(clip.audioSha256);
    expect(cue.frames).toMatch(/^[01]+$/);
    expect(
      Math.abs(cue.frames.length * cues.step - clip.duration),
    ).toBeLessThan(0.15);
  }
});

it('covers all chapter-two mixed lines with continuous provenance and keeps the accepted boxes pilot', () => {
  expect(bilingualPlan.audit).toHaveLength(320);
  expect(bilingualPlan.entries).toHaveLength(150);
  const mixed = manifest.clips.filter(
    (clip) =>
      /[A-Za-z]/.test(clip.sourceText) && /[А-Яа-яЁё]/.test(clip.sourceText),
  );
  expect(mixed).toHaveLength(239);
  for (const clip of mixed) {
    const current =
      reviewPlan.entries.find((entry) => entry.id === clip.id) ??
      bilingualPlan.entries.find((entry) => entry.id === clip.id) ??
      speechRepair.entries.find((entry) => entry.id === clip.id && entry.job);
    if (current?.job) {
      expect(current.sourceText).toBe(clip.sourceText);
      expect(current.job.request.text).toBe(clip.spokenText);
      expect(current.job.request.voiceId).toBe(clip.voiceId);
      expect(current.job.request).not.toHaveProperty('languageCode');
    } else {
      const original = elevenPlan.entries.find((entry) => entry.id === clip.id);
      expect(original?.requestHash, clip.id).toBe(clip.requestHash);
      expect(original?.request.text).toBe(clip.sourceText);
    }
  }
  const pilot = speechRepair.entries.find(
    (entry) => entry.id === 'chapter-02-09-task-02',
  )!;
  expect(bilingualPlan.entries.some((entry) => entry.id === pilot.id)).toBe(
    false,
  );
  expect(manifest.clips.find((clip) => clip.id === pilot.id)?.spokenText).toBe(
    pilot.spokenText,
  );
});

it('preserves the archived Qwen segmentation and reference provenance', () => {
  expect(qwenPlan.lines).toHaveLength(
    script.lines.filter((l) => l.speaker !== 'lumi').length,
  );
  for (const line of qwenPlan.lines) {
    expect(line.segments.map((segment) => segment.rawText).join('')).toBe(
      line.sourceText,
    );
    // Archived takes preserve their original text, even after editorial repairs.
    expect(script.lines.some((item) => item.id === line.id)).toBe(true);
    for (const segment of line.segments) {
      if (!segment.jobId) continue;
      const job = qwenPlan.jobs.find((item) => item.id === segment.jobId)!;
      const profile = line.speaker === 'marta' ? martaVoice : tikVoice;
      expect(job.voiceId).toBe(profile.voiceProfileId);
      expect(job.referenceAudioSha256).toBe(profile.referenceAudioSha256);
      expect(job.conditioning).toBe(
        job.language === 'English' ? 'speaker' : 'icl',
      );
      expect(job.text).not.toMatch(/\[(friendly|warmly|reassuring)\]/);
    }
  }
});

it('uses the selected ElevenLabs v3 actor for every current line and preserves the reviewed text', () => {
  expect(manifest.provider).toBe('elevenlabs');
  expect(manifest.modelId).toBe('eleven_v3');
  expect(cast.status).toBe('owner-selected');
  expect(elevenPlan.dialogueLines).toBe(script.lines.length);
  for (const clip of manifest.clips.filter((item) =>
    script.lines.some((line) => line.id === item.id),
  )) {
    const line = script.lines.find((line) => line.id === clip.id)!;
    const expectedVoice =
      line.speaker === 'marta'
        ? cast.voices.marta
        : line.speaker === 'lumi'
          ? cast.voices.lumi
          : cast.voices.tik;
    const entry = elevenPlan.entries.find((entry) => entry.id === clip.id)!;
    expect(clip.voiceId).toBe(expectedVoice.voiceId);
    const whole = bilingualPlan.entries.find((entry) => entry.id === clip.id);
    if (whole) {
      expect(clip.sourceText).toBe(line.sourceText);
      expect(clip.spokenText).toBe(whole.spokenText);
      expect(whole.job.request).toMatchObject({
        modelId: 'eleven_v3',
        voiceId: expectedVoice.voiceId,
        text: whole.spokenText,
        textNormalization: 'off',
      });
      expect(whole.job.request).not.toHaveProperty('languageCode');
      continue;
    }
    expect(clip.spokenText).toBe(
      clip.id === 'chapter-02-02-tik-success-02'
        ? line.sourceText.replace('нужен a,', 'нужен неопределённый артикль,')
        : clip.id === 'chapter-02-01-marta-feedback-speaker-marta'
          ? line.sourceText.replace('В I am Marta', 'В предложении I am Marta')
          : line.sourceText,
    );
    expect(entry.request).toMatchObject({
      modelId: 'eleven_v3',
      voiceId: expectedVoice.voiceId,
      text: line.sourceText,
      seed: 42,
    });
    const repair = repairs.patches.find((p) => p.clip.id === clip.id);
    expect(clip.requestHash).toBe(
      repair?.clip.requestHash ?? entry.requestHash,
    );
    if (repair) {
      expect(clip).toEqual(repair.clip);
      expect(
        createHash('sha256')
          .update(JSON.stringify(repair.assembly))
          .digest('hex'),
      ).toBe(clip.requestHash);
      expect(repair.assembly.segments.map((s) => s.rawText).join('')).toBe(
        line.sourceText,
      );
      for (const request of repair.assembly.requests) {
        expect(request.voiceId).toBe(expectedVoice.voiceId);
        expect(request.modelId).toBe('eleven_v3');
      }
    }
  }
});

it('covers every current 06–20 dialogue and feedback with the selected actor and full language takes', () => {
  const laterLevels = {
    ...stationNextLevels,
    ...departureLevels,
    ...finaleLevels,
  };
  const laterReflections = {
    ...stationNextReflections,
    ...departureReflections,
    ...finaleReflections,
  };
  const laterEntries = currentLaterEntries;
  const laterJobs = [
    ...nextPlan.jobs,
    ...departurePlan.jobs,
    ...finalePlan.jobs,
  ];
  const expected = [];
  for (const episode of Object.keys(
    laterLevels,
  ) as (keyof typeof laterLevels)[]) {
    let definition: LevelDefinition | undefined = laterLevels[episode];
    while (definition) {
      const room = { episode, definition, explanations: [] };
      for (const conversation of ['task', 'success'] as const) {
        const texts =
          conversation === 'task'
            ? definition.presentation!.introduction
            : definition.presentation!.success;
        for (let i = 0; i < texts.length; i++) {
          const line = dialogueVoiceLine(room, conversation, i)!;
          expected.push({
            id: line.id,
            sourceText: line.text,
            speaker: dialogueSpeaker(room, conversation, i),
          });
        }
      }
      if (!definition.continuation) {
        const i = definition.presentation!.success.length - 1;
        for (const choice of laterReflections[episode].choices) {
          const line = dialogueVoiceLine(
            { ...room, explanations: [choice.id] },
            'success',
            i,
          )!;
          expected.push({
            id: line.id,
            sourceText: line.text,
            speaker: dialogueSpeaker(room, 'success', i),
          });
        }
      }
      definition = definition.continuation;
    }
  }
  expect(expected).toHaveLength(246);
  expect(laterEntries).toHaveLength(expected.length);
  for (const line of expected) {
    const entry = laterEntries.find((item) => item.id === line.id)!;
    expect(entry).toMatchObject(line);
    const voice = cast.voices[line.speaker as keyof typeof cast.voices];
    expect(entry.voiceId).toBe(voice.voiceId);
    const clip = manifest.clips.find((item) => item.id === line.id)!;
    expect(clip).toMatchObject({
      ...line,
      voiceId: voice.voiceId,
      spokenText: entry.spokenText,
    });
    expect(createHash('sha256').update(line.sourceText).digest('hex')).toBe(
      entry.sourceTextHash,
    );
    const repair =
      reviewPlan.entries.find((item) => item.id === line.id) ??
      bilingualPlan.entries.find((item) => item.id === line.id) ??
      speechRepair.entries.find((item) => item.id === line.id);
    if (repair?.job) {
      expect(repair.action).toBe('continuous-take');
      expect(repair.job.request).toMatchObject({
        modelId: 'eleven_v3',
        voiceId: voice.voiceId,
        text: entry.spokenText,
        textNormalization: 'off',
      });
      expect(repair.job.request).not.toHaveProperty('languageCode');
      const request = repair.job.request;
      const requestHash = createHash('sha256')
        .update(JSON.stringify(request, Object.keys(request).sort()))
        .digest('hex');
      expect(requestHash).toBe(repair.job.requestHash);
      expect(entry.spokenText).not.toContain('в записи');
      continue;
    }
    if (!('segments' in entry)) throw new Error('Missing assembly provenance');
    expect(entry.segments.length).toBeGreaterThan(0);
    for (const segment of entry.segments) {
      const job = laterJobs.find((item) => item.request.id === segment.jobId)!;
      expect(job.requestHash).toBe(segment.requestHash);
      expect(job.request).toMatchObject({
        modelId: 'eleven_v3',
        voiceId: voice.voiceId,
        languageCode: segment.languageCode,
        text: segment.text,
      });
      if (segment.languageCode === 'en')
        expect(segment.text).not.toMatch(/[А-Яа-яЁё]/);
      else expect(segment.text).not.toMatch(/[A-Za-z]/);
    }
  }
  expect(
    manifest.clips.filter((clip) => /^chapter-02-(1[6-9]|20)-/.test(clip.id)),
  ).toHaveLength(79);
});

it('preserves English question intonation and expands comparison notation in the 11–15 speech plan', () => {
  for (const text of [
    'Are you ready?',
    'Is she ready?',
    'Are they ready?',
    'Is he ready?',
  ]) {
    expect(
      departurePlan.jobs.some(
        (job) => job.request.languageCode === 'en' && job.request.text === text,
      ),
    ).toBe(true);
  }
  expect(
    departurePlan.jobs.every((job) => !/[=→/]/.test(job.request.text)),
  ).toBe(true);
});

it('preserves the archived I extraction provenance and Marta’s corrected opening', () => {
  const tik = repairs.patches.find(
    (p) => p.clip.id === 'chapter-02-01-task-02',
  )!;
  const examples = tik.assembly.segments.filter((s) => s.rawText === 'I');
  expect(examples).toHaveLength(2);
  for (const segment of examples) {
    expect(segment.languageCode).toBe('en');
    expect(segment.text).toBe('The English pronoun is... I.');
    expect(segment).toMatchObject({ extractSuffix: 'I' });
    const extraction = 'extraction' in segment ? segment.extraction : undefined;
    expect(extraction).toMatchObject({
      method: 'quiet-gap-to-end-no-silence-trimming',
    });
    if (
      !extraction ||
      typeof extraction !== 'object' ||
      !('start' in extraction) ||
      !('end' in extraction) ||
      typeof extraction.start !== 'number' ||
      typeof extraction.end !== 'number'
    )
      throw new Error('Missing numeric audio boundaries');
    expect(extraction.start).toBeGreaterThan(1);
    expect(extraction.end - extraction.start).toBeGreaterThan(0.3);
  }
  expect(stationLevel.continuation!.presentation!.introduction[0]).toBe(
    'Я Марта, мастер фонарей. Помоги мне подписать мою бирку.',
  );
  const lumi = repairs.patches.find(
    (p) => p.clip.id === 'chapter-02-01-success-01',
  )!;
  expect(lumi.clip.voiceId).toBe(cast.voices.lumi.voiceId);
  expect(lumi.assembly.requests.map((r) => r.languageCode)).toEqual([
    'en',
    'ru',
  ]);
  expect(lumi.assembly.requests[0]!.text).toBe('I am Lumi.');
  for (const id of [
    'chapter-02-01-marta-feedback-speaker-marta',
    'chapter-02-02-task-03',
  ]) {
    const patch = repairs.patches.find((p) => p.clip.id === id)!;
    expect(patch).toBeDefined();
    for (const segment of patch.assembly.segments)
      if (/[A-Za-z]/.test(segment.rawText))
        expect(segment.languageCode).toBe('en');
  }
  const article = repairs.patches.find(
    (p) => p.clip.id === 'chapter-02-02-task-03',
  )!;
  const fullArticle = article.assembly.segments.find(
    (s) => s.rawText === 'a: lantern',
  );
  expect(fullArticle).toMatchObject({
    text: 'a lantern.',
    languageCode: 'en',
  });
  expect(fullArticle).not.toHaveProperty('extractPrefix');
  expect(fullArticle).not.toHaveProperty('extraction');
});

it('preserves archived contextual I/a repairs and replaces them with current continuous requests', () => {
  const vulnerable = script.lines.filter((line) =>
    [...line.sourceText.matchAll(/[A-Za-z]+(?:[ \t]+[A-Za-z]+)*/g)].some((m) =>
      ['I', 'a'].includes(m[0]),
    ),
  );
  expect(vulnerable).toHaveLength(14);
  for (const line of vulnerable) {
    const current = bilingualPlan.entries.find((e) => e.id === line.id);
    expect(current, line.id).toBeDefined();
    expect(current!.job.request.textNormalization).toBe('off');
    expect(current!.spokenText).toMatch(/\/aɪ\/|\/eɪ\//);
    const patch = repairs.patches.find((p) => p.clip.id === line.id);
    expect(patch, line.id).toBeDefined();
    for (const segment of patch!.assembly.segments) {
      const english = [
        ...segment.rawText.matchAll(/[A-Za-z]+(?:[ \t]+[A-Za-z]+)*/g),
      ];
      if (!english.length) continue;
      if (
        line.id === 'chapter-02-02-tik-success-02' &&
        segment.rawText.startsWith(' Почему перед')
      ) {
        expect(segment.text).toBe(
          'Почему перед lantern и robot нужен неопределённый артикль, а перед нашими именами его нет?',
        );
        expect(segment).not.toHaveProperty('extraction');
        expect(segment).not.toHaveProperty('languageCode');
        continue;
      }
      expect(segment.languageCode).toBe('en');
      if (english.some((m) => ['I', 'a'].includes(m[0]))) {
        // A complete English phrase preserves the article and following noun
        // without relying on character alignment as a phonetic boundary.
        if (
          segment.rawText.replace(/[^A-Za-z ]/g, '').trim() ===
          segment.text.replace(/[^A-Za-z ]/g, '').trim()
        ) {
          expect(segment).not.toHaveProperty('extraction');
          continue;
        }
        expect(segment).toHaveProperty('extraction.alignmentSha256');
        if ('extractSuffix' in segment) {
          expect(segment.extractSuffix).toBe('I');
          expect(segment).toHaveProperty(
            'extraction.method',
            'quiet-gap-to-end-no-silence-trimming',
          );
          expect(segment).toHaveProperty('extraction.audioSha256');
        } else {
          expect(segment).toHaveProperty('extractPrefix');
          expect(segment.text).toMatch(/^(I am Lumi|a lantern)\.$/);
        }
      }
    }
  }
});

it('removes every legacy I crop and keeps the Russian preposition attached to a spoken word', () => {
  const segments = repairs.patches.flatMap((p) => p.assembly.segments);
  expect(
    segments.filter((s) => 'extractPrefix' in s && s.extractPrefix === 'I'),
  ).toHaveLength(0);
  expect(
    segments.filter((s) => 'extractSuffix' in s && s.extractSuffix === 'I'),
  ).toHaveLength(11);
  const feedback = repairs.patches.find(
    (p) => p.clip.id === 'chapter-02-01-marta-feedback-speaker-marta',
  )!;
  const bridge = feedback.assembly.segments.find(
    (s) => s.rawText === ' указывает на автора сообщения. В ',
  );
  expect(bridge).toMatchObject({
    languageCode: 'ru',
    text: 'указывает на автора сообщения. В предложении',
  });
  expect(feedback.clip.spokenText).toContain('В предложении I am Marta');
  expect(
    feedback.assembly.segments.some((s) => /(?:^|\s)В[.!?]?$/.test(s.text)),
  ).toBe(false);
});
