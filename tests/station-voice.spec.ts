import { expect, test, type Page } from '@playwright/test';
import { observeAudio } from './helpers/cat-audio';
import { field } from './helpers/workshop';
import cues from '../src/game/station-mouth-cues.json' with { type: 'json' };
import {
  createPuzzle,
  reducePuzzle,
  type Direction,
} from '../src/domain/puzzle';
import { solveStation } from './helpers/solve-station';

const dialogue = (page: Page) =>
  page.getByRole('region', {
    name: /^(Разговор с (Тиком|Мартой)|Реплика Люми)$/,
  });

test('repaired language joins load new files and keep Marta and Tik mouths, repeat and mute in sync', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await observeAudio(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 800, height: 360 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const episode of [19, 16]) {
    await page.goto('/');
    await page.getByRole('button', { name: /Карта фонарей/ }).click();
    await page
      .getByRole('combobox', { name: 'Глава путешествия' })
      .selectOption('1');
    await page
      .getByRole('button', { name: new RegExp(`^Эпизод ${episode}:`) })
      .click();
    await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
    await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15000,
    });
    if (episode === 16) {
      while (
        await dialogue(page)
          .getByRole('button', { name: 'Дальше', exact: true })
          .count()
      )
        await dialogue(page)
          .getByRole('button', { name: 'Дальше', exact: true })
          .click();
      await dialogue(page)
        .getByRole('button', { name: 'Собрать ответ', exact: true })
        .click();
      let state = createPuzzle('chapter-02-16');
      const keys: Record<Direction, string> = {
        up: 'ArrowUp',
        down: 'ArrowDown',
        left: 'ArrowLeft',
        right: 'ArrowRight',
      };
      const labels: Record<Direction, string> = {
        up: 'Вверх',
        down: 'Вниз',
        left: 'Влево',
        right: 'Вправо',
      };
      for (const direction of solveStation(state, ['No', 'We', 'are', 'not'])) {
        if (info.project.name === 'mobile')
          await page
            .getByRole('button', { name: labels[direction], exact: true })
            .click();
        else await page.keyboard.press(keys[direction]);
        state = reducePuzzle(state, { type: 'move', direction });
      }
      await page
        .getByRole('button', { name: /Ответить/ })
        .click({ timeout: 10000 });
      await dialogue(page)
        .getByRole('button', { name: 'Следующая часть', exact: true })
        .click();
    }
    await dialogue(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
    const speaker = episode === 19 ? 'marta' : 'tik';
    const id =
      episode === 19 ? 'chapter-02-19-task-02' : 'chapter-02-16-i-task-02';
    const cue = cues.clips.find((item) => item.id === id)!;
    await expect
      .poll(() => activeStation(page))
      .toEqual([expect.stringContaining('/' + cue.file)]);
    await seekMouth(page, id, speaker, true);
    await page.screenshot({ path: info.outputPath(`repaired-${speaker}.png`) });
    await seekMouth(page, id, speaker, false);
    await dialogue(page)
      .getByRole('button', { name: 'Голос персонажа' })
      .click();
    await expect.poll(() => activeStation(page)).toEqual([]);
    await dialogue(page)
      .getByRole('button', { name: 'Голос персонажа' })
      .click();
    await dialogue(page)
      .getByRole('button', { name: 'Повторить реплику' })
      .click();
    await expectLine(page, speaker, id);
  }
  expect(errors).toEqual([]);
});
async function activeStation(page: Page) {
  return page.evaluate(() =>
    window.voiceTestPlayers
      .filter(
        (player) =>
          player.src.includes('/audio/station/') &&
          !player.paused &&
          !player.ended,
      )
      .map((player) => player.src),
  );
}
async function expectLine(page: Page, speaker: string, id: string) {
  await expect
    .poll(() => activeStation(page), { timeout: 15000 })
    .toEqual([expect.stringContaining(`/audio/station/${speaker}/${id}-`)]);
}
async function seekMouth(
  page: Page,
  id: string,
  speaker: string,
  open: boolean,
) {
  const cue = cues.clips.find((item) => item.id === id)!;
  const index = cue.frames.indexOf(open ? '111' : '000');
  expect(index).toBeGreaterThanOrEqual(0);
  await page.evaluate(
    (seconds) => {
      const player = window.voiceTestPlayers.find(
        (item) =>
          item.src.includes('/audio/station/') && !item.paused && !item.ended,
      )!;
      player.playbackRate = 0.1;
      player.currentTime = seconds;
    },
    (index + 0.5) * cues.step,
  );
  await expect(
    dialogue(page).locator('.station-portrait-sheet'),
  ).toHaveAttribute('data-mouth', open ? 'open' : 'closed');
  await expect(field(page)).toHaveAttribute(
    `data-${speaker}-frame`,
    open ? '3' : '0',
  );
}

for (const batch of [
  {
    name: '16–20',
    episodes: [
      [16, 'lumi'],
      [17, 'lumi'],
      [18, 'marta'],
      [19, 'marta'],
      [20, 'lumi'],
    ],
  },
  {
    name: '06–10',
    episodes: [
      [6, 'lumi'],
      [7, 'marta'],
      [8, 'marta'],
      [9, 'marta'],
      [10, 'tik'],
    ],
  },
  {
    name: '11–15',
    episodes: [
      [11, 'lumi'],
      [12, 'marta'],
      [13, 'tik'],
      [14, 'lumi'],
      [15, 'lumi'],
    ],
  },
] as const)
  test(`${batch.name} recordings play on entry with the right actor, mouth cues, repeat and mute`, async ({
    page,
  }, info) => {
    test.setTimeout(150000);
    await observeAudio(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    if (info.project.name === 'mobile')
      await page.setViewportSize({ width: 800, height: 360 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    for (const [episode, speaker] of batch.episodes) {
      await page.goto('/');
      await page.getByRole('button', { name: /Карта фонарей/ }).click();
      await page
        .getByRole('combobox', { name: 'Глава путешествия' })
        .selectOption('1');
      await page
        .getByRole('button', { name: new RegExp(`^Эпизод ${episode}:`) })
        .click();
      await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
      await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
        timeout: 15000,
      });
      const id = `chapter-02-${String(episode).padStart(2, '0')}-task-01`;
      await expectLine(page, speaker, id);
      await expect(dialogue(page)).toHaveAttribute('data-speaker', speaker);
      if (speaker !== 'lumi') {
        await seekMouth(page, id, speaker, true);
        await page.screenshot({
          path: info.outputPath(`new-${episode}-${speaker}-mouth.png`),
        });
        await seekMouth(page, id, speaker, false);
      } else
        await page.screenshot({
          path: info.outputPath(`new-${episode}-lumi-voice.png`),
        });
      await dialogue(page)
        .getByRole('button', { name: 'Голос персонажа' })
        .click();
      await expect.poll(() => activeStation(page)).toEqual([]);
      await dialogue(page)
        .getByRole('button', { name: 'Голос персонажа' })
        .click();
      await dialogue(page)
        .getByRole('button', { name: 'Повторить реплику' })
        .click();
      await expectLine(page, speaker, id);
      if (episode !== 20) {
        await dialogue(page)
          .getByRole('button', { name: 'Дальше', exact: true })
          .click();
        await expectLine(page, speaker, id.replace('task-01', 'task-02'));
      }
    }
    expect(errors).toEqual([]);
  });

test('real station voices: three actors, audio-driven mouths, word interruption, mute, pause and reduced motion', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeAudio(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expectLine(page, 'tik', 'chapter-02-01-task-01');
  await seekMouth(page, 'chapter-02-01-task-01', 'tik', true);
  await page.screenshot({ path: info.outputPath('tik-real-voice.png') });
  await seekMouth(page, 'chapter-02-01-task-01', 'tik', false);
  await dialogue(page)
    .getByRole('button', { name: 'Дальше', exact: true })
    .click();
  await expectLine(page, 'tik', 'chapter-02-01-task-02');
  await seekMouth(page, 'chapter-02-01-task-02', 'tik', true);
  await dialogue(page)
    .getByRole('button', { name: 'Послушать I', exact: true })
    .first()
    .click();
  await expect.poll(() => activeStation(page)).toEqual([]);
  await dialogue(page)
    .getByRole('button', { name: 'Повторить реплику' })
    .click();
  await expectLine(page, 'tik', 'chapter-02-01-task-02');
  await dialogue(page).getByRole('button', { name: 'Голос персонажа' }).click();
  await expect.poll(() => activeStation(page)).toEqual([]);
  await dialogue(page).getByRole('button', { name: 'Голос персонажа' }).click();
  await dialogue(page)
    .getByRole('button', { name: 'Повторить реплику' })
    .click();
  await expectLine(page, 'tik', 'chapter-02-01-task-02');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await expect.poll(() => activeStation(page)).toEqual([]);
  await expect(field(page)).toHaveAttribute('data-tik-frame', '0');
  await page.keyboard.press('Escape');
  while (
    await dialogue(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  ) {
    await dialogue(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  }
  await dialogue(page)
    .getByRole('button', { name: 'Собрать сообщение', exact: true })
    .click();
  if (info.project.name === 'mobile')
    await page.getByRole('button', { name: 'Вверх', exact: true }).click();
  else await page.keyboard.press('KeyW');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await expect(dialogue(page)).toHaveAttribute('data-speaker', 'lumi');
  await expectLine(page, 'lumi', 'chapter-02-01-success-01');
  await dialogue(page).getByRole('button', { name: 'Голос персонажа' }).click();
  await expect.poll(() => activeStation(page)).toEqual([]);
  await dialogue(page).getByRole('button', { name: 'Голос персонажа' }).click();
  await dialogue(page)
    .getByRole('button', { name: 'Повторить реплику' })
    .click();
  await expectLine(page, 'lumi', 'chapter-02-01-success-01');
  await page.screenshot({ path: info.outputPath('lumi-garry-voice.png') });
  await dialogue(page)
    .getByRole('button', { name: 'Послушать I', exact: true })
    .first()
    .click();
  await expect.poll(() => activeStation(page)).toEqual([]);
  await dialogue(page)
    .getByRole('button', { name: 'Повторить реплику' })
    .click();
  await expectLine(page, 'lumi', 'chapter-02-01-success-01');
  await dialogue(page)
    .getByRole('button', { name: 'Дальше', exact: true })
    .click();
  await expectLine(page, 'marta', 'chapter-02-01-success-02');
  await seekMouth(page, 'chapter-02-01-success-02', 'marta', true);
  const subtitles = dialogue(page).locator('.cat-line');
  await expect(subtitles).toBeVisible();
  const subtitleArea = await subtitles.boundingBox();
  // At least two readable lines on the 360px-high landscape viewport.
  expect(subtitleArea!.height).toBeGreaterThanOrEqual(48);
  const actionArea = await dialogue(page).locator('.cat-actions').boundingBox();
  expect(subtitleArea!.y + subtitleArea!.height).toBeLessThanOrEqual(
    actionArea!.y,
  );
  await page.screenshot({ path: info.outputPath('marta-real-voice.png') });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(
    dialogue(page).locator('.station-portrait-sheet'),
  ).toHaveAttribute('data-mouth', 'rest');
  await expect(field(page)).toHaveAttribute('data-marta-frame', '0');
  await expectLine(page, 'marta', 'chapter-02-01-success-02');
  expect(errors).toEqual([]);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  if (info.project.name === 'mobile')
    await page.setViewportSize({ width: 400, height: 900 });
  await dialogue(page)
    .getByRole('button', { name: 'Следующая часть', exact: true })
    .click();
  await expectLine(page, 'marta', 'chapter-02-01-marta-task-01');
  await expect(dialogue(page).locator('.cat-line')).toHaveText(
    'Я Марта, мастер фонарей. Помоги мне подписать мою бирку.',
  );
  // Watch ordinary playback, without seeking or slowing the audio: a seek-only
  // check can miss an animation that never runs when a new line starts.
  const naturalFrames = await page.evaluate(async () => {
    const frames: { mouth: string | undefined; background: string }[] = [];
    for (let index = 0; index < 35; index++) {
      const sheet = document.querySelector<HTMLElement>(
        '.station-portrait-sheet',
      )!;
      frames.push({
        mouth: sheet.dataset.mouth,
        background: getComputedStyle(sheet).backgroundPosition,
      });
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return frames;
  });
  await info.attach('marta-natural-playback', {
    body: JSON.stringify(naturalFrames),
    contentType: 'application/json',
  });
  expect(
    naturalFrames.some(
      (f) => f.mouth === 'open' && f.background === '100% 100%',
    ),
  ).toBe(true);
  expect(
    naturalFrames.some(
      (f) => f.mouth === 'closed' && f.background === '0px 0px',
    ),
  ).toBe(true);
  await dialogue(page)
    .getByRole('button', { name: 'Повторить реплику' })
    .click();
  await expectLine(page, 'marta', 'chapter-02-01-marta-task-01');
  await seekMouth(page, 'chapter-02-01-marta-task-01', 'marta', true);
  await page.screenshot({ path: info.outputPath('marta-short-intro.png') });
  expect(errors).toEqual([]);
});
