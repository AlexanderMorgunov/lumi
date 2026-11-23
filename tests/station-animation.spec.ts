import { test, expect } from '@playwright/test';
import { observeAudio, activeCat } from './helpers/cat-audio';
import cues from '../src/game/cat-mouth-cues.json' with { type: 'json' };
import { field } from './helpers/workshop';

test('both station portraits follow actual audio time and silence, mute and reduced motion', async ({
  page,
}, info) => {
  await observeAudio(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/tests/fixtures/station-portrait.html');
  const portrait = page.locator('.station-portrait-sheet');
  for (const character of ['marta', 'tik']) {
    await page.getByRole('button', { name: 'Тестовая запись' }).click();
    await expect.poll(() => activeCat(page)).toBe(1);
    for (const open of [true, false]) {
      const cue = cues.clips[0]!;
      const index = cue.frames.indexOf(open ? '111' : '000');
      await page.evaluate(
        (seconds) => {
          const player = window.voiceTestPlayers.find(
            (p) => !p.paused && !p.ended,
          )!;
          player.playbackRate = 0.1;
          player.currentTime = seconds;
        },
        (index + 0.5) * cues.step,
      );
      await expect(portrait).toHaveAttribute(
        'data-mouth',
        open ? 'open' : 'closed',
      );
      await expect(portrait).toHaveAttribute('data-frame', open ? '3' : '0');
      await page.screenshot({
        path: info.outputPath(
          `${character}-${open ? 'speaking' : 'silent'}.png`,
        ),
      });
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(portrait).toHaveAttribute('data-frame', '0');
    await expect(portrait).toHaveAttribute('data-mouth', 'rest');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await expect(portrait).toHaveAttribute('data-mouth', 'rest');
    await expect.poll(() => activeCat(page)).toBe(0);
    await page.getByRole('button', { name: 'Пауза', exact: true }).click();
    await page.getByRole('button', { name: 'Другой персонаж' }).click();
  }
  await page.getByRole('button', { name: 'Тестовая запись' }).click();
  await page.getByRole('button', { name: 'Выключить речь' }).click();
  await expect(portrait).toHaveAttribute('data-mouth', 'rest');
  await expect.poll(() => activeCat(page)).toBe(0);
});

test('station actors animate in place and settle on menu or reduced motion', async ({
  page,
}, info) => {
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
  await expect
    .poll(() => field(page).getAttribute('data-marta-frame'), {
      timeout: 10000,
      // The gesture lasts 700 ms; the default 1 s polling can miss it.
      intervals: [100],
    })
    .toBe('2');
  await page.screenshot({ path: info.outputPath('station-gesture.png') });
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await expect(field(page)).toHaveAttribute('data-marta-frame', '0');
  await expect(field(page)).toHaveAttribute('data-tik-frame', '0');
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(field(page)).toHaveAttribute('data-marta-frame', '0');
  await expect(field(page)).toHaveAttribute('data-tik-frame', '0');
  await expect(page.locator('.station-portrait-sheet')).toHaveAttribute(
    'data-mouth',
    'rest',
  );
});
