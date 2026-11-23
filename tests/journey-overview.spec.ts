import { expect, test } from '@playwright/test';

test('whole map fits without panning; all twelve hit targets remain separate through rotation', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  for (const [width, height] of [
    [1440, 900],
    [844, 390],
    [640, 360],
    [568, 320],
    [360, 800],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.locator('.episode-preview')).toHaveCount(0);
    const geometry = await page.locator('.overview-scene').evaluate((scene) => {
      const box = scene.getBoundingClientRect();
      const elements = [...scene.querySelectorAll('.lantern-stop')];
      const nodes = elements.map((n) => n.getBoundingClientRect());
      return {
        noScroll:
          scene.scrollWidth === scene.clientWidth &&
          scene.scrollHeight === scene.clientHeight,
        contained: nodes.every(
          (n) =>
            n.left >= box.left &&
            n.right <= box.right &&
            n.top >= box.top - 1 &&
            n.bottom <= box.bottom,
        ),
        touch: nodes.every((n) => n.width >= 44 && n.height >= 44),
        reachable: nodes.every(
          (n, i) =>
            document
              .elementFromPoint(n.left + n.width / 2, n.top + n.height / 2)
              ?.closest('button') === elements[i],
        ),
        overlap: nodes.some((a, i) =>
          nodes.some(
            (b, j) =>
              i < j &&
              a.left < b.right &&
              b.left < a.right &&
              a.top < b.bottom &&
              b.top < a.bottom,
          ),
        ),
      };
    });
    expect(geometry, `${width}×${height}`).toEqual({
      noScroll: true,
      contained: true,
      touch: true,
      reachable: true,
      overlap: false,
    });
    await page.mouse.move(width! / 2, height! / 2);
    await page.mouse.wheel(300, 300);
    expect(
      await page
        .locator('.overview-scene')
        .evaluate((n) => [n.scrollLeft, n.scrollTop]),
    ).toEqual([0, 0]);
  }
  await page.getByRole('button', { name: /^Эпизод 12:/ }).click();
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Закрыть описание эпизода' }).click();
  await expect(page.getByRole('button', { name: /^Эпизод 12:/ })).toBeFocused();
  await page.getByRole('button', { name: /^Эпизод 1:/ }).click();
  await page.mouse.click(8, 150);
  await expect(page.locator('.episode-preview')).toHaveCount(0);
});

test('rain is visual, honours reduced motion and never intercepts a lantern', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(page.locator('.journey-overview')).toHaveAttribute(
    'data-weather',
    'rain',
  );
  expect(
    await page
      .locator('.rain-layer')
      .evaluate((n) => getComputedStyle(n).pointerEvents),
  ).toBe('none');
  expect(
    await page
      .locator('.rain-layer i')
      .first()
      .evaluate((n) =>
        n.getAnimations().some((a) => a.playState === 'running'),
      ),
  ).toBe(true);
  await page.getByRole('button', { name: /^Эпизод 1:/ }).click();
  await expect(
    page.getByRole('button', { name: 'Продолжить эпизод', exact: true }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.rain-layer i')
      .first()
      .evaluate((n) => n.getAnimations().length),
  ).toBe(0);
});

test('host pause stops the rain and blocks entering an episode', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/host.html');
  const game = page.frameLocator('iframe');
  await game
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  const pause = async (type: string) =>
    page.evaluate((type) => {
      document.querySelector('iframe')?.contentWindow?.postMessage(
        {
          channel: 'dayenglish.game',
          version: 1,
          launchId: 'fixture-launch',
          type: 'event',
          event: { type },
        },
        location.origin,
      );
    }, type);
  await pause('paused');
  await expect(game.locator('.journey-overview')).toHaveAttribute(
    'data-weather',
    'paused',
  );
  await game.getByRole('button', { name: /^Эпизод 1:/ }).click();
  await expect(
    game.getByRole('button', { name: 'Продолжить эпизод', exact: true }),
  ).toBeDisabled();
  await pause('resumed');
  await expect(
    game.getByRole('button', { name: 'Продолжить эпизод', exact: true }),
  ).toBeEnabled();
});
