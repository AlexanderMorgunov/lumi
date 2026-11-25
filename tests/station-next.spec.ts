import { expect, test, type Page } from '@playwright/test';
import {
  stationNextLevels,
  stationNextReflections,
} from '../src/domain/station-next';
import {
  createPuzzle,
  reducePuzzle,
  type Direction,
} from '../src/domain/puzzle';
import { solveStation } from './helpers/solve-station';
import { field } from './helpers/workshop';

const dialogue = (page: Page) => page.locator('.cat-dialogue');
async function advance(page: Page) {
  while (
    await dialogue(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await dialogue(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
}
async function finish(page: Page, action: string) {
  await advance(page);
  await dialogue(page)
    .getByRole('button', { name: action, exact: true })
    .click();
}
async function mapGeometry(page: Page) {
  const lamps = page.locator('.station-map .lantern-stop');
  await expect(lamps).toHaveCount(20);
  const issues = await lamps.evaluateAll((nodes) =>
    nodes.flatMap((node) => {
      const r = node.getBoundingClientRect();
      const heading = document
        .querySelector('.station-map-title')!
        .getBoundingClientRect();
      const overlapsHeading =
        r.left < heading.right &&
        r.right > heading.left &&
        r.top < heading.bottom &&
        r.bottom > heading.top;
      const top = document.elementFromPoint(
        r.x + r.width / 2,
        r.y + r.height / 2,
      );
      return r.width < 44 ||
        r.height < 44 ||
        r.top < 0 ||
        r.bottom > innerHeight ||
        !node.contains(top) ||
        overlapsHeading
        ? [node.getAttribute('aria-label')]
        : [];
    }),
  );
  expect(issues).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
}

test('plays all 18 parts with recorded voices, checks contractions and meaning without runtime synthesis', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [];
  const newVoice: string[] = [];
  const recordedVoice: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (req) => {
    if (new URL(req.url()).hostname.endsWith('elevenlabs.io'))
      newVoice.push(req.url());
    if (/audio\/station\/.*chapter-02-(06|07|08|09|10)/.test(req.url()))
      recordedVoice.push(req.url());
  });
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await mapGeometry(page);
  await page.screenshot({ path: info.outputPath('station-ten-map.png') });
  await page.getByRole('button', { name: /^Эпизод 6:/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  const keys: Record<Direction, string> = {
    up: 'KeyW',
    down: 'ArrowDown',
    left: 'KeyA',
    right: 'ArrowRight',
  };
  const labels: Record<Direction, string> = {
    up: 'Вверх',
    down: 'Вниз',
    left: 'Влево',
    right: 'Вправо',
  };
  const short: Readonly<Record<string, string>> = {
    I: "I'm",
    You: "You're",
    He: "He's",
    She: "She's",
    It: "It's",
  };
  const ids = Object.keys(
    stationNextLevels,
  ) as (keyof typeof stationNextLevels)[];
  for (const id of ids) {
    let state = createPuzzle(id);
    while (true) {
      await expect(field(page)).toHaveAttribute(
        'data-level-id',
        state.definition.id,
      );
      await expect(page.getByLabel('Автор сообщения')).toBeVisible();
      if (
        state.definition.reference?.objects.some((o) => o.display === 'record')
      )
        await expect(field(page)).toHaveAttribute(
          'data-record-illustrations',
          /[a-z]/,
        );
      if (id === 'chapter-02-10')
        await page.screenshot({
          path: info.outputPath(`${state.definition.id}-dialogue.png`),
        });
      await finish(
        page,
        state.definition.message?.intent === 'label-group'
          ? 'Собрать подпись'
          : 'Собрать сообщение',
      );
      const full = state.definition.answers[0]!.words;
      const words = state.definition.allowContractions
        ? [short[full[0]!]!, ...full.slice(2)]
        : full;
      if (state.stage === 0 || id === 'chapter-02-09' || id === 'chapter-02-10')
        await page.screenshot({
          path: info.outputPath(`${state.definition.id}-board.png`),
        });
      // The reported layout: [empty, I'm, Lumi], solved through actual pushes.
      const slotOffset = id === 'chapter-02-06' && state.stage === 0 ? 1 : 0;
      for (const direction of solveStation(state, words, slotOffset)) {
        if (mobile)
          await page
            .getByRole('button', { name: labels[direction], exact: true })
            .click();
        else await page.keyboard.press(keys[direction]);
        state = reducePuzzle(state, { type: 'move', direction });
      }
      await expect(page.getByLabel('Слова в рамке чтения')).toHaveText(
        words.join('  '),
      );
      if (slotOffset)
        await page.screenshot({
          path: info.outputPath('right-aligned-contraction.png'),
        });
      await page
        .getByRole('button', { name: /Передать сообщение|Подписать запись/ })
        .click();
      state = reducePuzzle(state, { type: 'apply' });
      expect(state.completed).toBe(true);
      if (!state.definition.continuation) break;
      await finish(page, 'Следующая часть');
      state = reducePuzzle(state, { type: 'continue' });
    }
    await advance(page);
    const reflection = stationNextReflections[id];
    await dialogue(page)
      .getByRole('button', {
        name: reflection.choices.find((c) => c.id !== reflection.correct)!
          .label,
        exact: true,
      })
      .click();
    await expect(
      dialogue(page).getByRole('button', {
        name: 'Следующий эпизод',
        exact: true,
      }),
    ).toHaveCount(0);
    await dialogue(page)
      .getByRole('button', {
        name: reflection.choices.find((c) => c.id === reflection.correct)!
          .label,
        exact: true,
      })
      .click();
    await page.screenshot({ path: info.outputPath(`${id}-reflection.png`) });
    await finish(
      page,
      id === 'chapter-02-10' ? 'Вернуться к полю' : 'Следующий эпизод',
    );
  }
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await page.getByRole('button', { name: 'robots', exact: true }).click();
  await expect(page.locator('.word-heading img')).toHaveCount(2);
  await page.getByRole('button', { name: 'children', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('дети');
  await page.getByRole('button', { name: 'Закрыть слова' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await mapGeometry(page);
  await expect(
    page.getByRole('button', { name: /^Эпизод 10:.*Завершён/ }),
  ).toBeVisible();
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await mapGeometry(page);
    await page.screenshot({
      path: info.outputPath('station-ten-map-portrait.png'),
    });
  }
  expect(errors).toEqual([]);
  expect(newVoice).toEqual([]);
  for (const episode of ['06', '07', '08', '09', '10'])
    expect(
      recordedVoice.some((url) => url.includes(`chapter-02-${episode}`)),
    ).toBe(true);
});
