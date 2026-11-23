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
test('you addresses the listener: both maps, roles, voice, word audio, Undo, reflection and three lamps', async ({
  page,
}, info) => {
  test.setTimeout(120000);
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
  await page.getByRole('button', { name: /^Эпизод 3: Теперь.*Закрыт/ }).click();
  await expect(
    page.getByRole('button', { name: 'Начать эпизод', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-03');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Марта → Люми',
  );
  await voice(page, 'marta', 'chapter-02-03-task-01');
  await expect(talk(page).locator('.station-portrait-sheet')).toHaveAttribute(
    'data-mouth',
    'open',
  );
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await talk(page)
    .getByRole('button', { name: 'Послушать You', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.voiceTestPlayers.some(
          (p) => p.src.includes('/elevenlabs-marta-v1/you.mp3') && !p.paused,
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
  await page.getByRole('button', { name: 'Журнал', exact: true }).click();
  await page.getByText('Правило и слова', { exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Are нужно и при обращении к одному',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.screenshot({ path: info.outputPath('address-first.png') });
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
  await voice(page, 'marta', 'chapter-02-03-success-01');
  await finishTalk(page, 'Следующая часть');
  await expect(page.getByLabel('Автор сообщения')).toContainText('Люми → Тик');
  await voice(page, 'tik', 'chapter-02-03-tik-task-01');
  await expect(talk(page)).toContainText('ты говоришь, а я слушаю');
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Марта → Люми',
  );
  await page
    .getByRole('button', { name: 'Адресаты проверены', exact: true })
    .click();
  await finishTalk(page, 'Следующая часть');
  await finishTalk(page, 'Собрать сообщение');
  await page.screenshot({ path: info.outputPath('address-second.png') });
  await move('UDDLUUDLUDLU');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await voice(page, 'tik', 'chapter-02-03-tik-success-01');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'Обоих: are означает несколько героев',
      exact: true,
    })
    .click();
  await voice(page, 'tik', 'chapter-02-03-tik-feedback-address-group');
  await expect(talk(page).getByRole('status')).toContainText(
    'при обращении к одному',
  );
  await page
    .getByRole('button', { name: 'Тика: Люми обращался к нему', exact: true })
    .click();
  await voice(page, 'tik', 'chapter-02-03-tik-feedback-address-tik');
  await page.screenshot({ path: info.outputPath('address-complete.png') });
  await page
    .getByRole('button', { name: 'Следующий эпизод', exact: true })
    .click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-04');
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await page.getByRole('button', { name: 'are', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Matilda · ElevenLabs v3',
  );
  await page
    .getByRole('button', { name: 'Послушать are', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.voiceTestPlayers.some(
          (p) => p.src.includes('/elevenlabs-marta-v1/are.mp3') && !p.paused,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Закрыть слова' }).click();
  await page.getByRole('button', { name: 'Меню и пауза' }).click();
  await page
    .getByRole('button', { name: 'Карта фонарей · главы и эпизоды' })
    .click();
  await expect(
    page.getByRole('button', { name: /^Эпизод 3: Теперь.*Завершён/ }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('address-map.png') });
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({
      path: info.outputPath('address-map-portrait.png'),
    });
  }
  expect(errors).toEqual([]);
});
