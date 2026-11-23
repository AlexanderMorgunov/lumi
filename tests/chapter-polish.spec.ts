import { expect, test } from '@playwright/test';
import { field, finishTalk } from './helpers/workshop';

test('frame feedback, idle and joy respect independent menu pause', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  await page.keyboard.press('KeyA');
  await page.keyboard.press('KeyW');
  await expect(field(page)).toHaveAttribute('data-frame-feedback', 'assembled');
  await expect(field(page)).toHaveAttribute('data-lumi-mood', 'idle', {
    timeout: 7000,
  });
  await page.keyboard.press('Enter');
  await expect(field(page)).toHaveAttribute('data-frame-feedback', 'success');
  await expect(field(page)).toHaveAttribute('data-lumi-mood', 'joy');
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await expect(page.locator('main')).toHaveAttribute('data-animations', 'off');
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(page.getByText('1 из 12 эпизодов завершено')).toBeVisible();
});

test('word recordings play and stop on close, network failure remains recoverable', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Добавить в DayEnglish' }),
  ).toBeDisabled();
  await page
    .getByRole('button', { name: 'Послушать cat', exact: true })
    .click();
  await expect(page.locator('.word-audio-status')).toContainText(
    'Можно послушать ещё раз',
    { timeout: 7000 },
  );
  await page.getByRole('button', { name: 'Медленнее' }).click();
  await page.getByRole('button', { name: 'Закрыть слова' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Остановить', exact: true }),
  ).toHaveCount(0);
  await page.route('**/audio/en-US/lessac-v1/cat.wav', (route) =>
    route.abort(),
  );
  await page
    .getByRole('button', { name: 'Послушать cat', exact: true })
    .click();
  await expect(page.locator('.word-audio-status')).toContainText(
    /Не удалось|не запустил/,
  );
  await page.unroute('**/audio/en-US/lessac-v1/cat.wav');
  await page
    .getByRole('button', { name: 'Послушать cat', exact: true })
    .click();
  await expect(page.locator('.word-audio-status')).toContainText(
    'Можно послушать ещё раз',
    { timeout: 7000 },
  );
});

test('landscape road exposes twelve lanterns and explains locked chapters', async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(page.locator('.lantern-stop')).toHaveCount(12);
  await expect(
    page.locator('.lantern-stop[aria-current="step"]'),
  ).toBeInViewport();
  await page.getByRole('button', { name: /^Эпизод 12:/ }).click();
  await expect(page.locator('.lantern-stop').last()).toBeInViewport();
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Закрыть описание эпизода' }).click();
  await page.getByLabel('Глава путешествия').selectOption('1');
  await expect(
    page.getByText('Путь откроется после финала мастерской'),
  ).toBeVisible();
  await page.getByRole('button', { name: /^Эпизод 1: Имя на бирке/ }).click();
  await expect(page.locator('.journey-topic')).toContainText(/I.*am/);
  await expect(
    page.getByRole('button', { name: 'Эпизод пока закрыт' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Перейти к эпизоду' }),
  ).toHaveCount(0);
});

test('actual SDK transport waits for host confirmation and handles every capture outcome', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/host.html');
  const game = page.frameLocator('iframe');
  await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await game.getByRole('button', { name: 'Слова', exact: true }).click();
  const capture = game.getByRole('button', { name: 'Добавить в DayEnglish' });
  await expect(capture).toBeEnabled();
  await capture.click();
  await expect(
    game.getByRole('button', { name: 'Ожидаем подтверждения…' }),
  ).toBeDisabled();
  await expect(
    game.getByRole('button', { name: 'Послушать cat' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(game.locator('.capture-word')).toContainText(
    'Добавление отменено',
  );
  await capture.click();
  await page.getByRole('button', { name: 'Ошибка', exact: true }).click();
  await expect(game.locator('.capture-word')).toContainText(
    'Не удалось подтвердить',
  );
  await game.getByRole('button', { name: 'Повторить добавление' }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(
    game.getByRole('button', { name: '✓ В словаре DayEnglish' }),
  ).toBeDisabled();
  const requests = JSON.parse(await page.locator('#requests').innerText());
  expect(requests).toHaveLength(3);
  expect(requests[0]).toMatchObject({
    method: 'vocabulary.capture',
    payload: { term: 'cat', translation: 'кот / кошка' },
  });
  await game.getByRole('button', { name: 'Закрыть слова' }).click();
  await game.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(
    game.getByRole('button', { name: '✓ В словаре DayEnglish' }),
  ).toBeDisabled();
});

test('host without vocabulary capability never offers capture', async ({
  page,
}) => {
  await page.goto('/tests/fixtures/host.html?no-capability');
  const game = page.frameLocator('iframe');
  await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await game.getByRole('button', { name: 'Слова', exact: true }).click();
  await expect(
    game.getByRole('button', { name: 'Добавить в DayEnglish' }),
  ).toBeDisabled();
  await expect(page.locator('#requests')).toHaveText('[]');
});

for (const outcome of ['existing', 'closed'] as const) {
  test(`host ${outcome} never reports a fresh save`, async ({ page }) => {
    await page.goto('/tests/fixtures/host.html');
    const game = page.frameLocator('iframe');
    await game.getByRole('button', { name: 'Сразу в мастерскую' }).click();
    await game.getByRole('button', { name: 'Слова', exact: true }).click();
    await game.getByRole('button', { name: 'Добавить в DayEnglish' }).click();
    await page
      .getByRole('button', {
        name: outcome === 'existing' ? 'Уже есть' : 'Закрыть сессию',
        exact: true,
      })
      .click();
    await expect(game.locator('.capture-word')).toContainText(
      outcome === 'existing' ? 'уже есть в словаре' : 'Подтверждение прервано',
    );
    await expect(game.locator('.capture-word button')).toBeDisabled();
    await expect(game.locator('.capture-word')).not.toContainText(
      'Слово добавлено',
    );
  });
}
