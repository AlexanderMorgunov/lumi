import { expect, test, type Page } from '@playwright/test';
import { observeAudio } from './helpers/cat-audio';
import { field } from './helpers/workshop';
const talk = (page: Page) =>
  page.getByRole('region', { name: /^Разговор с (Тиком|Мартой)$/ });
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
async function voice(page: Page, speaker: string, id: string) {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          window.voiceTestPlayers
            .filter(
              (p) => p.src.includes('/audio/station/') && !p.paused && !p.ended,
            )
            .map((p) => p.src),
        ),
      { timeout: 15000 },
    )
    .toEqual([expect.stringContaining(`/audio/station/${speaker}/${id}-`)]);
}
test('it describes a pointed umbrella and a pictured egg with voices, Undo, journal and five reachable lamps', async ({
  page,
}, info) => {
  test.setTimeout(150000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await observeAudio(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const mobile = info.project.name === 'mobile';
  if (mobile) await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  await page.getByRole('button', { name: /Карта фонарей/ }).click();
  await page
    .getByRole('combobox', { name: 'Глава путешествия' })
    .selectOption('1');
  await expect(page.locator('.station-map .lantern-stop')).toHaveCount(15);
  await page
    .getByRole('button', { name: /^Эпизод 5: Кто потерял зонт.*Закрыт/ })
    .click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'station-lost-umbrella',
  );
  await expect(field(page)).toHaveAttribute('data-reference-card', 'false');
  await expect(page.getByLabel('Автор сообщения')).toContainText('Тик → Люми');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'О чём: зонт у стойки',
  );
  await voice(page, 'tik', 'chapter-02-05-task-01');
  await expect(talk(page).locator('.station-portrait-sheet')).toHaveAttribute(
    'data-mouth',
    'open',
  );
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await talk(page)
    .getByRole('button', { name: 'Послушать It', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.voiceTestPlayers.some(
          (p) => p.src.includes('/elevenlabs-tik-v1/it.mp3') && !p.paused,
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.voiceTestPlayers.filter(
            (p) => p.src.includes('/audio/station/') && !p.paused && !p.ended,
          ).length,
      ),
    )
    .toBe(0);
  await finishTalk(page, 'Собрать сообщение');
  await page.screenshot({ path: info.outputPath('objects-first.png') });
  const keys: Record<string, string> = { U: 'KeyW', D: 'KeyS', L: 'KeyA' };
  const labels: Record<string, string> = { U: 'Вверх', D: 'Вниз', L: 'Влево' };
  async function move(route: string) {
    for (const key of route) {
      if (mobile)
        await page
          .getByRole('button', { name: labels[key]!, exact: true })
          .click();
      else await page.keyboard.press(keys[key]!);
    }
  }
  await move('UDLU');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await finishTalk(page, 'Следующая часть');
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'station-egg-picture',
  );
  await expect(field(page)).toHaveAttribute('data-reference-card', 'true');
  await expect(page.getByLabel('Автор сообщения')).toContainText('Марта → Тик');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'О чём: яйцо на рисунке',
  );
  await voice(page, 'marta', 'chapter-02-05-egg-task-01');
  await expect(talk(page).locator('.station-portrait-sheet')).toHaveAttribute(
    'data-mouth',
    'open',
  );
  await page.screenshot({ path: info.outputPath('objects-dialogue.png') });
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-05');
  await expect(field(page)).toHaveAttribute(
    'data-reference-target',
    'station-lost-umbrella',
  );
  await page
    .getByRole('button', { name: 'Находка описана', exact: true })
    .click();
  await finishTalk(page, 'Следующая часть');
  await finishTalk(page, 'Собрать сообщение');
  await page.screenshot({ path: info.outputPath('objects-egg.png') });
  await move('UDDLUUDLUDLU');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await voice(page, 'marta', 'chapter-02-05-egg-success-01');
  await expect(field(page)).toHaveAttribute('data-reference-location', 'table');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'It выбирают только для русского среднего рода',
      exact: true,
    })
    .click();
  await voice(page, 'tik', 'chapter-02-05-egg-feedback-object-russian');
  await expect(talk(page).getByRole('status')).toContainText(
    'Род русского слова не определяет выбор',
  );
  await page
    .getByRole('button', {
      name: 'Речь об обычных предметах; понятно, о каком именно',
      exact: true,
    })
    .click();
  await voice(page, 'tik', 'chapter-02-05-egg-feedback-object-ordinary');
  await page.screenshot({ path: info.outputPath('objects-complete.png') });
  await page.getByRole('button', { name: 'На станцию', exact: true }).click();
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Тик → Люми (о чём: зонт у стойки): It is an umbrella.',
  );
  await expect(page.getByRole('dialog')).toContainText(
    'Марта → Тик (о чём: яйцо на рисунке): It is an egg.',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await page.getByRole('button', { name: 'It', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Тик, Will · ElevenLabs v3',
  );
  await page.getByRole('button', { name: 'Закрыть слова' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(
    page.getByRole('button', { name: /^Эпизод 5: Кто потерял зонт.*Завершён/ }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('objects-map.png') });
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(async () => {
      const img = new Image();
      img.src = '/art/journey/station-road-portrait-rain-v1.png';
      await img.decode();
    });
    await page.screenshot({
      path: info.outputPath('objects-map-portrait.png'),
    });
  }
  const hittable = await page
    .locator('.station-map .lantern-stop')
    .evaluateAll((nodes) =>
      nodes.every((node) => {
        const r = node.getBoundingClientRect();
        return (
          document
            .elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
            ?.closest('button') === node
        );
      }),
    );
  expect(hittable).toBe(true);
  expect(errors).toEqual([]);
});
