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
test('he and she identify a third person through three maps, voice, role transfer, Undo and five lamps', async ({
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
  await expect(page.locator('.station-map .lantern-stop')).toHaveCount(20);
  await page.getByRole('button', { name: /^Эпизод 4: О ком.*Закрыт/ }).click();
  await page.getByRole('button', { name: 'DEV · Открыть эпизод' }).click();
  await expect(field(page)).toHaveAttribute('data-scene-state', 'ready', {
    timeout: 15000,
  });
  await expect(page.getByLabel('Автор сообщения')).toContainText('Тик → Люми');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'О ком: Марта',
  );
  await voice(page, 'tik', 'chapter-02-04-task-01');
  await expect(talk(page).locator('.station-portrait-sheet')).toHaveAttribute(
    'data-mouth',
    'open',
  );
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await talk(page)
    .getByRole('button', { name: 'Послушать She', exact: true })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.voiceTestPlayers.some(
          (p) => p.src.includes('/elevenlabs-tik-v1/she.mp3') && !p.paused,
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
  await expect(page.getByRole('dialog')).toContainText('О ком: Марта');
  await expect(page.getByRole('dialog')).not.toContainText(
    'Нужно назвать имя автора',
  );
  await page.getByRole('button', { name: 'Вернуться к полю' }).click();
  await page.screenshot({ path: info.outputPath('third-first.png') });
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
  await finishTalk(page, 'Следующая часть');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Марта → Люми',
  );
  await expect(page.getByLabel('Автор сообщения')).toContainText('О ком: Тик');
  await voice(page, 'marta', 'chapter-02-04-tik-task-01');
  await finishTalk(page, 'Собрать сообщение');
  await move('UDDLUUDLUDLU');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await finishTalk(page, 'Следующая часть');
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Люми → Марта',
  );
  await expect(page.getByLabel('Автор сообщения')).toContainText('О ком: Тик');
  await voice(page, 'tik', 'chapter-02-04-transfer-task-01');
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(field(page)).toHaveAttribute(
    'data-level-id',
    'chapter-02-04-tik',
  );
  await expect(page.getByLabel('Автор сообщения')).toContainText(
    'Марта → Люми',
  );
  await page
    .getByRole('button', { name: 'Записи о спутниках', exact: true })
    .click();
  await finishTalk(page, 'Следующая часть');
  await finishTalk(page, 'Собрать сообщение');
  await page.screenshot({ path: info.outputPath('third-transfer.png') });
  await move('UUDLUDLUDLU');
  await page.getByRole('button', { name: /Передать сообщение/ }).click();
  await voice(page, 'tik', 'chapter-02-04-transfer-success-01');
  await talk(page).getByRole('button', { name: 'Дальше', exact: true }).click();
  await page
    .getByRole('button', {
      name: 'He всегда обозначает того, кто говорит',
      exact: true,
    })
    .click();
  await voice(page, 'tik', 'chapter-02-04-transfer-feedback-third-speaker');
  await expect(talk(page).getByRole('status')).toContainText('авторы менялись');
  await page
    .getByRole('button', {
      name: 'Оба говорили о Тике, хотя говорящие менялись',
      exact: true,
    })
    .click();
  await voice(page, 'tik', 'chapter-02-04-transfer-feedback-third-subject');
  await page.screenshot({ path: info.outputPath('third-complete.png') });
  await page
    .getByRole('button', { name: 'Следующий эпизод', exact: true })
    .click();
  await expect(field(page)).toHaveAttribute('data-level-id', 'chapter-02-05');
  await finishTalk(page, 'Собрать сообщение');
  await page.getByRole('button', { name: 'Слова', exact: true }).click();
  await page.getByRole('button', { name: 'is', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Тик, Will · ElevenLabs v3',
  );
  await page.getByRole('button', { name: 'Послушать is', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.voiceTestPlayers.some(
          (p) => p.src.includes('/elevenlabs-tik-v1/is.mp3') && !p.paused,
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
    page.getByRole('button', { name: /^Эпизод 4: О ком.*Завершён/ }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath('third-map.png') });
  if (mobile) {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.evaluate(async () => {
      const img = new Image();
      img.src = '/art/journey/station-road-portrait-rain-v1.png';
      await img.decode();
    });
    await page.screenshot({ path: info.outputPath('third-map-portrait.png') });
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
