import { expect, test } from '@playwright/test';
import { field, finishTalk, talk } from './helpers/workshop';
import { activeCat, observeAudio } from './helpers/cat-audio';

test('first episode speaks, repeats, mutes independently and never resumes an old line', async ({
  page,
}, info) => {
  await observeAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  // Initial narration waits for the scene assets, like the first movement.
  await expect.poll(() => activeCat(page), { timeout: 15000 }).toBe(1);
  const toggle = talk(page).getByRole('button', {
    name: 'Голос кота',
    exact: true,
  });
  const repeat = talk(page).getByRole('button', { name: 'Повторить реплику' });
  await repeat.click();
  await expect.poll(() => activeCat(page)).toBe(1);
  await expect
    .poll(() => page.evaluate(() => window.voiceTestPlayers.length))
    .toBe(2);
  await toggle.click();
  await expect.poll(() => activeCat(page)).toBe(0);
  await expect(repeat).toBeDisabled();
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  await expect.poll(() => activeCat(page)).toBe(0);
  await repeat.click();
  await expect.poll(() => activeCat(page)).toBe(1);
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await expect.poll(() => activeCat(page)).toBe(0);
  await page.getByRole('button', { name: /^Настройки/ }).click();
  await expect(
    page.getByRole('checkbox', { name: 'Голоса персонажей', exact: true }),
  ).toBeChecked();
  await page.getByRole('button', { name: 'Закрыть настройки' }).click();
  await expect.poll(() => activeCat(page)).toBe(0);
  await repeat.click();
  await expect.poll(() => activeCat(page)).toBe(1);
  // Real MP3 playback, UI in both phone orientations and the desktop viewport.
  for (const size of info.project.name === 'mobile'
    ? [
        { width: 360, height: 800 },
        { width: 844, height: 390 },
      ]
    : [{ width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    await expect(toggle).toBeInViewport();
    await expect(repeat).toBeInViewport();
    await expect(
      talk(page).getByRole('button', { name: 'Сделать первый шаг' }),
    ).toBeInViewport();
    await page.screenshot({
      path: `artifacts/qa/cat-voice-${size.width}x${size.height}.png`,
    });
  }
});

test('English interrupts narration, mute preserves vocabulary and next-episode feedback is voiced', async ({
  page,
}, info) => {
  await observeAudio(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect.poll(() => activeCat(page)).toBe(1);
  const word = talk(page).getByRole('button', {
    name: 'Послушать an',
    exact: true,
  });
  await word.click();
  await expect.poll(() => activeCat(page)).toBe(0);
  await expect(page.locator('.cat-portrait-motion')).toHaveAttribute(
    'data-mouth',
    'rest',
  );
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  await talk(page)
    .getByRole('button', { name: 'Голос кота', exact: true })
    .click();
  await word.click();
  await expect(word).toHaveAttribute('aria-pressed', 'true');
  await finishTalk(page, 'Попробовать');
  await expect.poll(() => activeCat(page)).toBe(0);
  for (const key of ['KeyA', 'KeyW', 'Enter']) await page.keyboard.press(key);
  await expect(talk(page)).toContainText('Вот карточка, держи');
  await expect(
    talk(page).getByRole('button', { name: 'Голос кота', exact: true }),
  ).toHaveAttribute('aria-pressed', 'false');
  await talk(page)
    .getByRole('button', { name: 'Голос кота', exact: true })
    .click();
  await talk(page).getByRole('button', { name: 'Повторить реплику' }).click();
  await expect.poll(() => activeCat(page)).toBe(1);
  await talk(page).getByRole('button', { name: 'Следующая просьба' }).click();
  await expect(talk(page)).toContainText('Ключ');
  await expect(
    talk(page).getByRole('group', { name: 'Озвучка кота' }),
  ).toBeVisible();
  await expect.poll(() => activeCat(page)).toBe(1);
  await finishTalk(page, 'Начать просьбу');
  for (const key of [
    'KeyA',
    'KeyW',
    'KeyS',
    'KeyD',
    'KeyD',
    'KeyD',
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyA',
    'KeyW',
    'Enter',
  ])
    await page.keyboard.press(key);
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  const activeFile = () =>
    page.evaluate(
      () =>
        window.voiceTestPlayers.find(
          (player) =>
            player.src.includes('/audio/cat/') &&
            !player.paused &&
            !player.ended,
        )?.src ?? '',
    );
  await expect.poll(activeFile).toContain('chapter-01-02-success-02');
  const wrong = talk(page).getByRole('button', {
    name: 'Несколько ключей сразу',
  });
  await wrong.click();
  await expect.poll(activeFile).toContain('chapter-01-02-feedback-several');
  await expect.poll(() => activeCat(page)).toBe(1);
  const beforeRepeat = await page.evaluate(
    () => window.voiceTestPlayers.length,
  );
  await wrong.click();
  await expect
    .poll(() => page.evaluate(() => window.voiceTestPlayers.length))
    .toBe(beforeRepeat + 1);
  await expect.poll(() => activeCat(page)).toBe(1);
  await page.screenshot({
    path: `artifacts/qa/cat-feedback-${info.project.name}.png`,
  });
  await talk(page)
    .getByRole('button', { name: 'Один любой подходящий ключ' })
    .click();
  await expect.poll(activeFile).toContain('chapter-01-02-feedback-any');
  await talk(page).getByRole('button', { name: 'Следующая просьба' }).click();
  await expect.poll(activeFile).toContain('chapter-01-03-task-01');
  await expect.poll(() => activeCat(page)).toBe(1);
});

test('missing recording leaves subtitles and navigation available; replay recovers', async ({
  page,
}) => {
  await observeAudio(page);
  const pattern = '**/audio/cat/**/ep01-meet-01-*.mp3';
  await page.route(pattern, (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await expect(talk(page).locator('.cat-voice-message')).toContainText(
    /недоступна|Повторить/,
  );
  await expect(talk(page)).toContainText('Проснулся, Люми?');
  await expect(
    talk(page).getByRole('button', { name: 'Дальше', exact: true }),
  ).toBeEnabled();
  await page.unroute(pattern);
  await talk(page).getByRole('button', { name: 'Повторить реплику' }).click();
  await expect.poll(() => activeCat(page)).toBe(1);
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect.poll(() => activeCat(page)).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => window.voiceTestPlayers.filter((player) => !player.paused).length,
      ),
    )
    .toBe(1);
});

test('host pause, visibility and close cancel speech without resurrecting it', async ({
  page,
}) => {
  await observeAudio(page);
  await page.goto('/tests/fixtures/host.html');
  const frame = page.frameLocator('iframe');
  const game = page
    .frames()
    .find((candidate) => candidate.url().includes('hosted-game.html'))!;
  await frame.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  const playing = () =>
    game.evaluate(
      () =>
        window.voiceTestPlayers.filter(
          (player) => player.src.includes('/audio/cat/') && !player.paused,
        ).length,
    );
  await expect.poll(playing).toBe(1);
  const send = (type: string) =>
    page.evaluate((eventType) => {
      document.querySelector('iframe')!.contentWindow!.postMessage(
        {
          channel: 'dayenglish.game',
          version: 1,
          launchId: 'fixture-launch',
          type: 'event',
          event: { type: eventType },
        },
        location.origin,
      );
    }, type);
  await send('paused');
  await expect.poll(playing).toBe(0);
  await send('resumed');
  await expect.poll(playing).toBe(0);
  await frame.getByRole('button', { name: 'Повторить реплику' }).click();
  await expect.poll(playing).toBe(1);
  await game.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(playing).toBe(0);
  await game.evaluate(() => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(playing).toBe(0);
  await frame.getByRole('button', { name: 'Повторить реплику' }).click();
  await expect.poll(playing).toBe(1);
  await send('closed');
  await expect.poll(playing).toBe(0);
});
