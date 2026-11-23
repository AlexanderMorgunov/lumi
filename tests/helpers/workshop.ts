import { expect, type Page } from '@playwright/test';
export const talk = (page: Page) =>
  page.getByRole('region', { name: 'Разговор с котом' });
export const field = (page: Page) =>
  page.getByRole('group', { name: /^Игровое поле/ });
export async function finishTalk(page: Page, action: string) {
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
export async function unlockEgg(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Сразу в мастерскую' }).click();
  await finishTalk(page, 'Сделать первый шаг');
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await page.keyboard.press('KeyD');
  await finishTalk(page, 'Попробовать');
  for (const key of ['KeyA', 'KeyW', 'Enter']) await page.keyboard.press(key);
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
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
  await page
    .getByRole('button', { name: 'Один любой подходящий ключ' })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
  await finishTalk(page, 'Собрать просьбу');
  await page.keyboard.press('KeyW');
  await page.keyboard.press('Enter');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Следующая просьба' }),
  ).toHaveCount(0);
  await page
    .getByRole('button', { name: 'В apple первый звук — гласный' })
    .click();
  await page.getByRole('button', { name: 'Следующая просьба' }).click();
}

export async function unlockThe(page: Page) {
  await unlockEgg(page);
  const right = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowRight',
    'ArrowRight',
    'ArrowUp',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowDown',
    'ArrowLeft',
    'ArrowUp',
  ];
  const left = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowUp',
    'ArrowRight',
    'ArrowDown',
    'ArrowRight',
    'ArrowUp',
  ];
  for (const step of [
    { route: right, answer: 'Любое одно; an перед гласным звуком' },
    { route: right, answer: 'Один любой ключ; key начинается с /k/' },
    { route: left, answer: 'Один любой плод; apple начинается с /æ/' },
  ]) {
    await finishTalk(page, 'Начать просьбу');
    for (const key of step.route) await page.keyboard.press(key);
    await page.keyboard.press('Enter');
    while (
      await talk(page)
        .getByRole('button', { name: 'Дальше', exact: true })
        .count()
    )
      await talk(page)
        .getByRole('button', { name: 'Дальше', exact: true })
        .click();
    await page.getByRole('button', { name: step.answer, exact: true }).click();
    await page.getByRole('button', { name: 'Следующая просьба' }).click();
  }
}

export async function selectEpisodeFromMenu(
  page: Page,
  id: import('../../src/domain/episodes').EpisodeId,
) {
  const { chapterOneStops } = await import('../../src/domain/journey');
  const index = chapterOneStops.findIndex((stop) => stop.ids.includes(id));
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await page
    .getByRole('button', { name: new RegExp('^Эпизод ' + (index + 1) + ':') })
    .click();
  await page
    .getByRole('button', {
      name:
        id === 'choiceKey'
          ? 'Просьба о ключе'
          : id === 'choiceApple'
            ? 'Просьба о яблоке'
            : /^(Перейти к эпизоду|Продолжить эпизод)$/,
    })
    .click();
}
