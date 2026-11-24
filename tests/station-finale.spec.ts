import { expect, test, type Page } from '@playwright/test';
import { finaleLevels, finaleReflections } from '../src/domain/station-finale';
import {
  createPuzzle,
  reducePuzzle,
  type Direction,
} from '../src/domain/puzzle';
import { solveStation } from './helpers/solve-station';
import { exchangeVariants } from './helpers/exchange-variants';
import { exchangeText } from '../src/domain/station-exchange';
import { field } from './helpers/workshop';
import { observeAudio } from './helpers/cat-audio';

const talk = (page: Page) => page.locator('.cat-dialogue');
async function advance(page: Page) {
  while (
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
}
async function finish(page: Page, action: string) {
  await advance(page);
  await talk(page).getByRole('button', { name: action, exact: true }).click();
}
test('plays 16–20 through keyboard/touch; letter authors, optional phrases, gathering break, recorded dialogue and map', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const mobile = info.project.name === 'mobile';
  const errors: string[] = [],
    speech: string[] = [];
  const recordings: string[] = [];
  await observeAudio(page);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/elevenlabs\.io/.test(request.url())) speech.push(request.url());
    if (/audio\/station\/.*chapter-02-(1[6-9]|20)/.test(request.url()))
      recordings.push(request.url());
  });
  if (mobile) await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  for (const [width, height] of mobile
    ? [
        [568, 320],
        [640, 360],
        [360, 800],
        [800, 360],
      ]
    : [[1280, 720]]) {
    await page.setViewportSize({ width: width!, height: height! });
    const lamps = page.locator('.station-map .lantern-stop');
    await expect(lamps).toHaveCount(20);
    const bad = await lamps.evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const r = node.getBoundingClientRect();
        const heading = document
          .querySelector('.station-map-title')!
          .getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        const overlaps = (b: DOMRect) =>
          Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 &&
          Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1;
        return r.width < 44 ||
          r.height < 44 ||
          r.top < 0 ||
          r.left < 0 ||
          r.right > innerWidth ||
          r.bottom > innerHeight ||
          !node.contains(hit) ||
          overlaps(heading) ||
          nodes.some(
            (other) =>
              other !== node && overlaps(other.getBoundingClientRect()),
          )
          ? [node.getAttribute('aria-label')]
          : [];
      }),
    );
    expect(bad, `${width}x${height}`).toEqual([]);
    await page.screenshot({ path: info.outputPath(`map-${width}.png`) });
  }
  await page.getByRole('button', { name: /^Эпизод 16:/ }).click();
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
  for (const id of Object.keys(finaleLevels) as (keyof typeof finaleLevels)[]) {
    let state = createPuzzle(id);
    while (true) {
      await expect(field(page)).toHaveAttribute(
        'data-level-id',
        state.definition.id,
      );
      if (
        state.definition.reference?.objects.some((o) => o.display === 'record')
      )
        await expect(field(page)).toHaveAttribute(
          'data-record-illustrations',
          /[a-z]/,
        );
      const context = state.definition.message!.exchange!;
      await expect
        .poll(() =>
          page.evaluate(() =>
            window.voiceTestPlayers
              .filter(
                (player) =>
                  player.src.includes('/audio/station/') &&
                  !player.paused &&
                  !player.ended,
              )
              .map((player) => player.src),
          ),
        )
        .toEqual([expect.stringContaining(`${state.definition.id}-task-01-`)]);
      await expect(page.getByLabel('Автор сообщения')).toContainText(
        context.inquiry!.before,
      );
      if (context.inquiry!.authorLabel)
        await expect(page.getByLabel('Автор сообщения')).toContainText(
          context.inquiry!.authorLabel,
        );
      if (
        !state.stage ||
        ['nora', 'six', 'group-question'].some((suffix) =>
          state.definition.id.endsWith('-' + suffix),
        )
      )
        await page.screenshot({
          path: info.outputPath(`${state.definition.id}-dialogue.png`),
        });
      await finish(
        page,
        context.act === 'question'
          ? 'Собрать вопрос'
          : context.act === 'short-answer'
            ? 'Собрать ответ'
            : 'Собрать сообщение',
      );
      if (!state.stage || state.definition.id.endsWith('-nora'))
        await page.screenshot({
          path: info.outputPath(`${state.definition.id}-board.png`),
        });
      const accepted = context.inquiry!.accepted.at(-1)!;
      const variants = exchangeVariants(accepted).filter(
        (words) =>
          words.every((w) =>
            state.pieces.some((p) => p.kind === 'word' && p.word === w),
          ) && !(words[0] === 'Yes' && words.length === 2),
      );
      const words = variants.at(-1)!;
      for (const direction of solveStation(state, words)) {
        if (mobile)
          await page
            .getByRole('button', { name: labels[direction], exact: true })
            .click();
        else await page.keyboard.press(keys[direction]);
        state = reducePuzzle(state, { type: 'move', direction });
      }
      await expect(page.getByLabel('Слова в рамке чтения')).toHaveText(
        exchangeText(words) + (context.act === 'question' ? '?' : ''),
      );
      await page
        .getByRole('button', {
          name: /Передать сообщение|Задать вопрос|Ответить/,
        })
        .click();
      state = reducePuzzle(state, { type: 'apply' });
      expect(state.completed).toBe(true);
      await expect(page.getByLabel('Автор сообщения')).toContainText(
        context.inquiry!.reply,
      );
      if (!state.definition.continuation) break;
      await finish(
        page,
        state.definition.presentation!.continuationAction ?? 'Следующая часть',
      );
      state = reducePuzzle(state, { type: 'continue' });
    }
    await advance(page);
    const reflection = finaleReflections[id];
    await talk(page)
      .getByRole('button', {
        name: reflection.choices.find(
          (choice) => choice.id !== reflection.correct,
        )!.label,
        exact: true,
      })
      .click();
    await expect(
      talk(page).getByRole('button', { name: 'Следующий эпизод', exact: true }),
    ).toHaveCount(0);
    await talk(page)
      .getByRole('button', {
        name: reflection.choices.find(
          (choice) => choice.id === reflection.correct,
        )!.label,
        exact: true,
      })
      .click();
    await finish(
      page,
      id === 'chapter-02-20' ? 'На станцию' : 'Следующий эпизод',
    );
  }
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('How old');
  await expect(page.getByRole('dialog')).toContainText('No, I’m not');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(
    page.getByRole('button', { name: /^Эпизод 20:.*Завершён/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(speech).toEqual([]);
  for (const episode of [16, 17, 18, 19, 20])
    expect(
      recordings.some((url) => url.includes(`chapter-02-${episode}-`)),
    ).toBe(true);
});

test('age explanation stays scrollable and its actions reachable in narrow landscape and portrait', async ({
  page,
}, info) => {
  test.setTimeout(90000);
  for (const [width, height] of [
    [568, 320],
    [360, 800],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.goto('/');
    await page.getByRole('button', { name: /Карта фонарей/ }).click();
    await page
      .getByRole('combobox', { name: 'Глава путешествия' })
      .selectOption('1');
    await page.getByRole('button', { name: /^Эпизод 19:/ }).click();
    await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
    await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
      timeout: 15000,
    });
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
    const body = page.locator('.cat-line');
    expect(
      await body.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    await body.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    expect(
      await body.evaluate(
        (el) => el.scrollHeight - el.clientHeight - el.scrollTop,
      ),
    ).toBeLessThanOrEqual(1);
    const next = talk(page).getByRole('button', {
      name: 'Дальше',
      exact: true,
    });
    expect(
      await next.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.left >= 0 &&
          r.top >= 0 &&
          r.right <= innerWidth &&
          r.bottom <= innerHeight &&
          el.contains(
            document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2),
          )
        );
      }),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`age-reading-${width}.png`),
    });
    await finish(page, 'Собрать вопрос');
    await page.getByRole('button', { name: 'Журнал', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('years old');
    await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  }
});
