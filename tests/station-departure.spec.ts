import { expect, test, type Page } from '@playwright/test';
import {
  departureLevels,
  departureReflections,
} from '../src/domain/station-departure';
import {
  createPuzzle,
  reducePuzzle,
  type Direction,
} from '../src/domain/puzzle';
import { exchangeText } from '../src/domain/station-exchange';
import { solveStation } from './helpers/solve-station';
import { exchangeVariants } from './helpers/exchange-variants';
import { field } from './helpers/workshop';

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
async function checkMap(page: Page) {
  await expect(page.locator('.station-map .lantern-stop')).toHaveCount(20);
  const issues = await page
    .locator('.station-map .lantern-stop')
    .evaluateAll((nodes) =>
      nodes.flatMap((node) => {
        const r = node.getBoundingClientRect();
        const heading = document
          .querySelector('.station-map-title')!
          .getBoundingClientRect();
        const hit = document.elementFromPoint(
          r.x + r.width / 2,
          r.y + r.height / 2,
        );
        const overlap =
          r.left < heading.right &&
          r.right > heading.left &&
          r.top < heading.bottom &&
          r.bottom > heading.top;
        const otherLamp = nodes.some((other) => {
          if (other === node) return false;
          const b = other.getBoundingClientRect();
          return (
            Math.min(r.right, b.right) - Math.max(r.left, b.left) > 1 &&
            Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top) > 1
          );
        });
        return r.width < 44 ||
          r.height < 44 ||
          r.top < 0 ||
          r.bottom > innerHeight ||
          !node.contains(hit) ||
          overlap ||
          otherLamp
          ? [node.getAttribute('aria-label')]
          : [];
      }),
    );
  expect(issues).toEqual([]);
}

test('plays 11–15 with real keyboard/touch input, unknown question facts, short answers, journal and fifteen reachable lamps', async ({
  page,
}, info) => {
  test.setTimeout(300000);
  const errors: string[] = [],
    voiceRequests: string[] = [];
  const recordings: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (new URL(r.url()).hostname.endsWith('elevenlabs.io'))
      voiceRequests.push(r.url());
    if (/audio\/station\/.*chapter-02-1[1-5]/.test(r.url()))
      recordings.push(r.url());
  });
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await checkMap(page);
  await page.screenshot({ path: info.outputPath('departure-map.png') });
  if (mobile) {
    for (const [width, height] of [
      [568, 320],
      [640, 360],
    ]) {
      await page.setViewportSize({ width: width!, height: height! });
      await checkMap(page);
      await page.screenshot({
        path: info.outputPath(`departure-map-${width}.png`),
      });
    }
    await page.setViewportSize({ width: 800, height: 360 });
  }
  await page.getByRole('button', { name: /^Эпизод 11:/ }).click();
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
  for (const id of Object.keys(
    departureLevels,
  ) as (keyof typeof departureLevels)[]) {
    let state = createPuzzle(id);
    while (true) {
      await expect(field(page)).toHaveAttribute(
        'data-level-id',
        state.definition.id,
      );
      const context = state.definition.message?.exchange;
      if (context?.act === 'question') {
        await expect(page.getByLabel('Автор сообщения')).toContainText(
          'ответ ещё не получен',
        );
        await expect(page.getByLabel('Автор сообщения')).not.toContainText(
          context.evidence,
        );
      }
      if (context?.question)
        await expect(page.getByLabel('Автор сообщения')).toContainText(
          context.question,
        );
      if (state.stage === 0)
        await page.screenshot({ path: info.outputPath(`${id}-dialogue.png`) });
      await finish(
        page,
        context?.act === 'question'
          ? 'Собрать вопрос'
          : context?.act === 'short-answer'
            ? 'Собрать ответ'
            : state.definition.message?.intent === 'label-group'
              ? 'Собрать подпись'
              : 'Собрать сообщение',
      );
      if (state.stage === 0)
        await page.screenshot({ path: info.outputPath(`${id}-board.png`) });
      const full = state.definition.answers[0]!.words;
      const variants =
        context?.act === 'short-answer'
          ? [[...full]]
          : exchangeVariants(full).filter((words) =>
              words.every((w) =>
                state.pieces.some((p) => p.kind === 'word' && p.word === w),
              ),
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
        context
          ? exchangeText(words) + (context.act === 'question' ? '?' : '')
          : words.join('  '),
      );
      await page
        .getByRole('button', {
          name: /Передать сообщение|Подписать запись|Задать вопрос|Ответить/,
        })
        .click();
      state = reducePuzzle(state, { type: 'apply' });
      expect(state.completed).toBe(true);
      if (context?.act === 'question')
        await expect(page.getByLabel('Автор сообщения')).toContainText(
          context.ready ? 'Да,' : 'Нет,',
        );
      if (!state.definition.continuation) break;
      await finish(page, 'Следующая часть');
      state = reducePuzzle(state, { type: 'continue' });
    }
    await advance(page);
    const reflection = departureReflections[id];
    await talk(page)
      .getByRole('button', {
        name: reflection.choices.find((c) => c.id !== reflection.correct)!
          .label,
        exact: true,
      })
      .click();
    await expect(
      talk(page).getByRole('button', { name: 'Следующий эпизод', exact: true }),
    ).toHaveCount(0);
    await talk(page)
      .getByRole('button', {
        name: reflection.choices.find((c) => c.id === reflection.correct)!
          .label,
        exact: true,
      })
      .click();
    await page.screenshot({ path: info.outputPath(`${id}-reflection.png`) });
    await finish(
      page,
      id === 'chapter-02-15' ? 'На станцию' : 'Следующий эпизод',
    );
  }
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Yes, I am.');
  await expect(page.getByRole('dialog')).toContainText('Yes, we are.');
  await expect(page.getByRole('dialog')).toContainText('Yes, he is.');
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await checkMap(page);
  await expect(
    page.getByRole('button', { name: /^Эпизод 15:.*Завершён/ }),
  ).toBeVisible();
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await checkMap(page);
    await page.screenshot({
      path: info.outputPath('departure-map-portrait.png'),
    });
  }
  expect(errors).toEqual([]);
  expect(voiceRequests).toEqual([]);
  for (const episode of ['11', '12', '13', '14', '15'])
    expect(
      recordings.some((url) => url.includes(`chapter-02-${episode}`)),
    ).toBe(true);
});
