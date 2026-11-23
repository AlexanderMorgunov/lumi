import { expect, test, type Page } from '@playwright/test';
import { field } from './helpers/workshop';
import { observeAudio } from './helpers/cat-audio';

const talk = (page: Page) =>
  page.getByRole('region', {
    name: /^(Разговор с (Тиком|Мартой)|Реплика Люми)$/,
  });
async function finishTalk(page: Page, action: string) {
  while (
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .count()
  )
    await talk(page)
      .getByRole('button', { name: 'Дальше', exact: true })
      .click();
  await talk(page).getByRole('button', { name: action, exact: true }).click();
}
test('station: arrival, two authors, touch/keyboard, journal, undo, replay and progressive words', async ({
  page,
}, info) => {
  const mobile = info.project.name === 'mobile';
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await observeAudio(page);
  if (mobile) await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/tests/fixtures/station.html');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await page
    .getByRole('button', { name: 'Перейти к эпизоду', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Дорога к станции' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Подойти к станции →' }),
  ).toBeFocused();
  await page.screenshot({ path: info.outputPath('arrival.png') });
  await page
    .getByRole('button', { name: 'К карте фонарей', exact: true })
    .click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await page
    .getByRole('button', { name: 'Перейти к эпизоду', exact: true })
    .click();
  await page.getByRole('button', { name: 'Подойти к станции →' }).click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-01');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready');
  await expect(page.locator('[data-marta-visible="true"]')).toBeVisible();
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Сообщение: Люми → Марта',
  );
  await expect(
    talk(page).getByRole('group', { name: 'Озвучка кота' }),
  ).toHaveCount(0);
  await page.screenshot({ path: info.outputPath('station-dialogue.png') });
  await finishTalk(page, 'Собрать сообщение');
  await expect(field(page)).toBeFocused();
  const canvas = await page.locator('canvas').elementHandle();
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.getByLabel('Автор сообщения')).toBeInViewport();
    await page.screenshot({ path: info.outputPath('station-portrait.png') });
    await page.setViewportSize({ width: 800, height: 360 });
  }
  await page.screenshot({ path: info.outputPath('station-field.png') });
  if (mobile) {
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(
      page.getByRole('button', { name: /Передать сообщение/ }),
    ).toBeInViewport({ ratio: 1 });
    await expect(page.getByLabel('Автор сообщения')).toBeInViewport({
      ratio: 1,
    });
    await page.screenshot({
      path: info.outputPath('station-small-landscape.png'),
    });
    await page.setViewportSize({ width: 800, height: 360 });
  }
  if (mobile)
    await page.getByRole('button', { name: 'Вверх', exact: true }).click();
  else await page.keyboard.press('KeyW');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await expect(talk(page)).toHaveAttribute('data-speaker', 'lumi');
  await expect(talk(page)).toContainText('Я Люми');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(talk(page)).toHaveAttribute('data-speaker', 'marta');
  await expect(
    talk(page).getByRole('img', { name: 'Марта, мастер фонарей' }),
  ).toBeVisible();
  await finishTalk(page, 'Следующая часть');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Сообщение: Марта → Люми',
  );
  await expect(talk(page)).toHaveAttribute('data-speaker', 'marta');
  await expect(talk(page)).toContainText('Я Марта, мастер фонарей');
  await expect(talk(page).locator('.station-speaker-name')).toBeInViewport();
  await page.screenshot({ path: info.outputPath('marta-speaking.png') });
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await expect(
      talk(page).getByRole('img', { name: 'Марта, мастер фонарей' }),
    ).toBeInViewport();
    await page.screenshot({ path: info.outputPath('marta-portrait.png') });
    await page.setViewportSize({ width: 800, height: 360 });
  }
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Автор: Марта. Слушатель: Люми.',
  );
  await expect(page.getByRole('dialog')).toContainText('I am Lumi.');
  await page.getByRole('button', { name: 'Закрыть журнал' }).click();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-01');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Сообщение: Люми',
  );
  await page
    .getByRole('button', { name: 'Имена на бирках', exact: true })
    .click();
  await finishTalk(page, 'Следующая часть');
  await finishTalk(page, 'Собрать сообщение');
  const keys: Record<string, string> = {
    U: 'ArrowUp',
    D: 'ArrowDown',
    L: 'ArrowLeft',
  };
  const labels: Record<string, string> = { U: 'Вверх', D: 'Вниз', L: 'Влево' };
  for (const key of 'UUDDLUUDLU') {
    if (mobile)
      await page
        .getByRole('button', { name: labels[key]!, exact: true })
        .click();
    else await page.keyboard.press(keys[key]!);
  }
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await expect(talk(page)).toHaveAttribute('data-speaker', 'marta');
  await expect(talk(page)).toContainText('Я Марта. Спасибо, Люми!');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(talk(page)).toHaveAttribute('data-speaker', 'tik');
  await page
    .getByRole('button', {
      name: 'I всегда означает Люми, ведь я им управляю',
      exact: true,
    })
    .click();
  await expect(talk(page).getByRole('status')).toContainText(
    'Управление героем',
  );
  await page
    .getByRole('button', {
      name: 'Теперь говорит Марта — I означает её',
      exact: true,
    })
    .click();
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
    .toEqual([
      expect.stringContaining(
        '/audio/station/tik/chapter-02-01-marta-feedback-speaker-marta-',
      ),
    ]);
  await page.screenshot({ path: info.outputPath('station-complete.png') });
  await page.getByRole('button', { name: 'На станцию', exact: true }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Встреченные · 18' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть слова' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(
    page.getByRole('combobox', { name: 'Глава путешествия' }),
  ).toHaveValue('1');
  await expect(page.locator('.station-map .completed')).toHaveCount(1);
  await page.screenshot({ path: info.outputPath('station-map.png') });
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await page
    .getByRole('button', { name: 'Продолжить эпизод', exact: true })
    .click();
  await expect(
    page.getByRole('region', { name: 'Дорога к станции' }),
  ).toHaveCount(0);
  await expect(field(page)).toHaveAttribute(
    'data-level-id',
    'chapter-02-01-marta',
  );
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  expect(errors).toEqual([]);
});

test('station preview stays locked before chapter one is completed', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await page.getByRole('button', { name: /^Эпизод 1: Имя/ }).click();
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('dialog', { name: 'Имя на бирке' }),
  ).toContainText('Заверши финальный эпизод мастерской');
});
