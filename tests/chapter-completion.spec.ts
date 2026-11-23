import { selectEpisodeFromMenu } from './helpers/workshop';
import { expect, test } from '@playwright/test';
import { field, talk, finishTalk, unlockThe } from './helpers/workshop';
import {
  closingEpisodes,
  closingLevels,
  closingReflections,
} from '../src/domain/closing-chapter';
import type { LevelDefinition } from '../src/domain/levels';
import { activeCat, expectCatLine, observeAudio } from './helpers/cat-audio';

const routes: Record<number, string[]> = {
  1: [
    'Up',
    'Up',
    'Down',
    'Left',
    'Left',
    'Left',
    'Left',
    'Up',
    'Right',
    'Right',
    'Down',
    'Right',
    'Up',
  ],
  3: ['Up', 'Up', 'Down', 'Left', 'Up'],
  5: [
    'Up',
    'Up',
    'Down',
    'Right',
    'Right',
    'Up',
    'Left',
    'Left',
    'Down',
    'Left',
    'Up',
  ],
};
const touchLabels: Record<string, string> = {
  Up: 'Вверх',
  Down: 'Вниз',
  Left: 'Влево',
  Right: 'Вправо',
};

test('completes voiced episodes 8–12 through real controls with linked objects, journal, error recovery and chapter ending', async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await observeAudio(page);
  await unlockThe(page);
  for (const answer of [
    'Кот и Люми понимают, какой именно ключ нужен',
    'Яблоко указано обоим; гласный звук не отменяет the',
  ]) {
    await finishTalk(
      page,
      answer.startsWith('Кот') ? 'Собрать просьбу' : 'Начать просьбу',
    );
    for (const key of routes[5]!) await page.keyboard.press(`Arrow${key}`);
    await page.keyboard.press('Enter');
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
    await page.getByRole('button', { name: answer, exact: true }).click();
    await page
      .getByRole('button', { name: 'Следующая просьба', exact: true })
      .click();
  }
  const canvas = await page.locator('canvas').elementHandle();
  for (const id of Object.keys(
    closingEpisodes,
  ) as (keyof typeof closingEpisodes)[]) {
    let level: LevelDefinition | undefined = closingLevels[id];
    let selected = '';
    while (level) {
      await expect(field(page)).toHaveAttribute('data-level-id', level.id);
      await expect(talk(page)).toContainText(
        level.presentation!.introduction[0]!,
      );
      await expectCatLine(page, `${level.id.toLowerCase()}-task-01`);
      await finishTalk(page, 'Начать просьбу');
      await expect.poll(() => activeCat(page)).toBe(0);
      await expect(field(page)).toBeFocused();
      if (level.optionalLeadingArticle && !level.carryReference) {
        await page.getByRole('button', { name: 'Слова', exact: true }).click();
        await expect(page.locator('.word-heading img')).toHaveCount(2);
        await page
          .locator('.word-heading img')
          .evaluateAll((images) =>
            Promise.all(
              images.map((image) => (image as HTMLImageElement).decode()),
            ),
          );
        await expect(
          page.getByRole('heading', {
            name: level.presentation!.noun,
            exact: true,
          }),
        ).toBeVisible();
        await page.screenshot({
          path: info.outputPath(`${level.presentation!.noun}-wordbook.png`),
        });
        await page.getByRole('button', { name: 'Закрыть слова' }).click();
        await expect(field(page)).toBeFocused();
        // A genuinely empty article slot is a choice; a/an stay available.
        for (const x of [1, 3, 5]) {
          for (const key of routes[x]!)
            await page.keyboard.press(`Arrow${key}`);
          await page.keyboard.press('Enter');
          await expect(
            page.getByRole('button', { name: /Передать просьбу/ }),
          ).toBeEnabled();
          await expect(page.getByRole('status')).toContainText(
            x === 5 ? 'конкретные' : 'множественное число',
          );
          for (let i = 0; i < routes[x]!.length; i++)
            await page.keyboard.press('KeyZ');
        }
        await page
          .getByRole('button', { name: 'Слушать слова на поле' })
          .click();
        await page
          .getByRole('button', {
            name: `Послушать ${level.presentation!.noun} на поле`,
          })
          .click();
        await expect(page.locator('.listening-bar')).toContainText(
          'Можно послушать ещё раз',
          { timeout: 6000 },
        );
        await page.keyboard.press('Escape');
        await expect(field(page)).toBeFocused();
      }
      if (level.carryReference) {
        await expect(field(page)).toHaveAttribute(
          'data-reference-target',
          selected,
        );
        await expect(field(page)).toHaveAttribute(
          'data-reference-location',
          'selected',
        );
      }
      if (id === 'newWords' || id === 'mixedRequests') {
        await page.getByRole('button', { name: 'Журнал', exact: true }).click();
        await page.getByText('Правило этой просьбы', { exact: true }).click();
        await expect(page.getByRole('dialog')).toContainText(
          level.presentation!.rule,
        );
        await page.getByRole('button', { name: 'Вернуться к полю' }).click();
      }
      await page.screenshot({ path: info.outputPath(`${level.id}-scene.png`) });
      const goal = level.answers.find((a) => a.goal)!;
      const articleX = level.pieces.find(
        (p) => p.kind === 'word' && p.word === goal.words[0],
      )!.x;
      const route =
        level.optionalLeadingArticle && goal.words.length === 1
          ? ['Up', 'Up']
          : routes[articleX]!;
      for (const direction of route) {
        if (mobile)
          await page
            .getByRole('button', { name: touchLabels[direction]!, exact: true })
            .tap();
        else await page.keyboard.press(`Arrow${direction}`);
      }
      await expect(page.getByLabel('Слова в рамке чтения')).toHaveText(
        goal.words.join(' '),
      );
      if (level.optionalLeadingArticle) {
        // Let the 240 ms movement tween finish before capturing the board.
        await page.waitForTimeout(350);
        await page.screenshot({
          path: info.outputPath(`${level.id}-assembled.png`),
        });
        if (mobile && level.id.endsWith('plural-1')) {
          await page.setViewportSize({ width: 360, height: 800 });
          await expect(
            page.getByRole('button', { name: /Передать просьбу/ }),
          ).toBeInViewport();
          await page.screenshot({
            path: info.outputPath('plural-portrait.png'),
          });
          await page.setViewportSize({ width: 844, height: 390 });
        }
      }
      await page.getByRole('button', { name: /Передать просьбу/ }).click();
      await expect(talk(page)).toContainText(level.presentation!.success[0]!);
      await expectCatLine(page, `${level.id.toLowerCase()}-success-01`);
      selected = (await field(page).getAttribute('data-reference-target'))!;
      await expect(field(page)).toHaveAttribute(
        'data-reference-location',
        goal.effect!.type === 'select' ? 'selected' : goal.effect!.destination!,
      );
      while (
        await talk(page)
          .getByRole('button', { name: 'Дальше', exact: true })
          .count()
      )
        await talk(page)
          .getByRole('button', { name: 'Дальше', exact: true })
          .click();
      if (level.continuation) {
        await expect(
          page.getByRole('button', { name: 'Следующая просьба', exact: true }),
        ).toHaveCount(0);
        await page
          .getByRole('button', { name: 'Следующая часть', exact: true })
          .click();
      } else {
        const reflection = closingReflections[id];
        await expect(
          page.getByRole('button', { name: 'Следующая просьба', exact: true }),
        ).toHaveCount(0);
        const wrong = reflection.choices.find(
          (choice) => choice.id !== reflection.correct,
        )!;
        await page
          .getByRole('button', { name: wrong.label, exact: true })
          .click();
        await expect(talk(page).getByRole('status')).toHaveText(wrong.feedback);
        await expectCatLine(
          page,
          `${level.id.toLowerCase()}-feedback-${wrong.id}`,
        );
        await page
          .getByRole('button', { name: 'Выбрать другой ответ' })
          .click();
        const correct = reflection.choices.find(
          (choice) => choice.id === reflection.correct,
        )!;
        await page
          .getByRole('button', { name: correct.label, exact: true })
          .click();
        await expectCatLine(
          page,
          `${level.id.toLowerCase()}-feedback-${correct.id}`,
        );
        if (id !== 'chapterFinale')
          await page
            .getByRole('button', { name: 'Следующая просьба', exact: true })
            .click();
        else {
          await expect(
            page.getByRole('heading', { name: 'Глава 1 завершена' }),
          ).toBeVisible();
          await expect(
            page.getByRole('button', {
              name: 'Следующая просьба',
              exact: true,
            }),
          ).toHaveCount(0);
          await page.screenshot({
            path: info.outputPath('chapter-complete.png'),
          });
          if (mobile) {
            await page.setViewportSize({ width: 360, height: 800 });
            await expect(
              page.getByRole('button', { name: 'В мастерскую', exact: true }),
            ).toBeInViewport();
            await page.screenshot({
              path: info.outputPath('chapter-complete-portrait.png'),
            });
          }
          await page
            .getByRole('button', { name: 'В мастерскую', exact: true })
            .click();
        }
      }
      level = level.continuation;
    }
  }
  await expect.poll(() => activeCat(page)).toBe(0);
  // Finishing the chapter must not reduce the dictionary to the final key request.
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Словарь игры' });
  await expect(
    library
      .getByRole('navigation', { name: 'Выбрать слово' })
      .getByRole('button'),
  ).toHaveCount(13);
  await library.getByRole('button', { name: 'cat', exact: true }).click();
  await expect(
    library.getByRole('button', { name: 'Послушать cat', exact: true }),
  ).toBeEnabled();
  await library.getByRole('button', { name: /^В этой просьбе/ }).click();
  await expect(
    library
      .getByRole('navigation', { name: 'Выбрать слово' })
      .getByRole('button'),
  ).toHaveText(['key', 'the', 'an', 'a']);
  await library.getByRole('button', { name: 'Закрыть слова' }).click();
  if (mobile) await page.setViewportSize({ width: 844, height: 390 });
  await page.keyboard.press('KeyZ');
  await expect(field(page)).toHaveAttribute(
    'data-reference-location',
    'selected',
  );
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'newWords');
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-01-11-3');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page.getByRole('button', { name: 'Начать комнату заново' }).click();
  await page.getByRole('button', { name: 'Начать эпизод заново' }).click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-01-11-1');
  // Chapter transition uses the actually earned unlock, without replaying the prologue.
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await selectEpisodeFromMenu(page, 'chapterFinale');
  await finishTalk(page, 'Начать просьбу');
  await page.keyboard.press('Enter');
  while (
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  await page
    .getByRole('button', { name: 'Отправиться на станцию', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Дорога к станции' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Подойти к станции →' }).click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-01');
  await expect(
    page.getByRole('region', { name: 'Разговор с Тиком' }),
  ).toBeVisible();
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});
