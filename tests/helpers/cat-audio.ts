import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    voiceTestPlayers: HTMLAudioElement[];
  }
}

export async function observeAudio(page: Page) {
  await page.addInitScript(() => {
    window.voiceTestPlayers = [];
    window.Audio = new Proxy(window.Audio, {
      construct(target, args) {
        const player = Reflect.construct(target, args) as HTMLAudioElement;
        // Foreground speech only; the long-lived music player has no initial URL.
        if (
          typeof args[0] === 'string' &&
          /\/audio\/(cat|station|en-US)\//.test(args[0])
        )
          window.voiceTestPlayers.push(player);
        return player;
      },
    });
  });
}

export async function activeCat(page: Page) {
  return page.evaluate(
    () =>
      window.voiceTestPlayers.filter(
        (player) =>
          player.src.includes('/audio/cat/') && !player.paused && !player.ended,
      ).length,
  );
}

export async function expectCatLine(page: Page, id: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.voiceTestPlayers
            .filter(
              (player) =>
                player.src.includes('/audio/cat/') &&
                !player.paused &&
                !player.ended &&
                player.readyState >= 2,
            )
            .map((player) => player.src),
        ),
      { timeout: 15000 },
    )
    .toEqual([expect.stringContaining(`/${id}-`)]);
}
