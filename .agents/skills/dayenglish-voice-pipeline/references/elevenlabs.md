# ElevenLabs: authoring API

Дополнение 22.11.2026: для смешанных учебных реплик сначала прочитать [mixed-language](mixed-language.md). Helper поддерживает `textNormalization: "off"` (`apply_text_normalization` в API); значение входит в хеш кэша. Это отключает нормализацию текста, но не гарантирует правильное произношение. Для новых реплик не использовать прежнюю автоматическую нарезку по каждому языковому переходу.

Сверено 16.11.2026 по официальным endpoint-документам. Перед реальной генерацией проверить доступные модели и голоса текущего аккаунта; наличие имени в этом файле не доказывает доступ. Ключ — только `ELEVENLABS_API_KEY` в окружении процесса. Не читать/выводить чужие секреты ради проверки доступа.

| Задача                       | API                                                                                                   | Результат                                       |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Пробы нового голоса          | [POST /v1/text-to-voice/design](https://elevenlabs.io/docs/api-reference/text-to-voice/design)        | Несколько previews с аудио и generated_voice_id |
| Реплика существующим голосом | [POST /v1/text-to-speech/{voice_id}](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) | Аудиофайл                                       |
| Мурчание/мяу                 | [POST /v1/sound-generation](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert)   | Отдельный SFX-файл                              |

Generated voice ID из preview не считать сохранённым voice_id для TTS: после выбора требуется отдельное создание голоса через `/v1/text-to-voice`. Этот шаг helper не выполняет. Не сохранять все кандидаты в аккаунт автоматически. Существующий доступный voice_id можно использовать сразу.

## Helper

Из корня проекта, Node из package.json, без установки зависимостей:

```powershell
node .agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs --request .agents/skills/dayenglish-voice-pipeline/references/cat-preview.json --out artifacts/voice
```

Команда только проверяет JSON и показывает план, символы и отпечаток; не обращается к сети и не требует ключ. После поручения сгенерировать этот объём использовать ту же команду с `--execute`. Ключ должен быть установлен в окружении заранее; не подставлять его строкой в команду или файл запроса.

В этом проекте владелец сохранил ключ в игнорируемом `.env`. Для загрузки использовать встроенную поддержку Node: `node --env-file=.env .agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.mjs --request .agents/skills/dayenglish-voice-pipeline/references/cat-preview.json --out artifacts/voice`. Содержимое `.env` не выводить. Не добавлять ключу префикс VITE_.

Если проверочный GET возвращает 302 на `geo-restriction.elevenlabs.io`, это ограничение доступа из текущего окружения, а не подтверждение неверного ключа. Не пересылать заголовок авторизации по редиректу, не запускать генерацию и не повторять запросы, пока условия доступа не изменятся.

JSON: `kind` = `design`, `speech` или `sfx`; `id` — устойчивое имя дубля; `modelId`, `text` — обязательны. Для `design` также `voiceDescription`, для `speech` — `voiceId`, для `sfx` — `durationSeconds`. Дополнительно для speech/design разрешён `seed`. Неизвестные поля отклоняются, чтобы опечатка не стала платным запросом с неожиданными настройками.

Speech example (реальный доступный voiceId подставить после кастинга):

```json
{
  "kind": "speech",
  "id": "cat-meet-line-01-take-01",
  "modelId": "eleven_v3",
  "voiceId": "SELECTED_ACCOUNT_VOICE_ID",
  "text": "Проснулся, Люми? Марта тебя уже ждёт.",
  "seed": 42
}
```

Helper сохраняет MP3 44.1 kHz / 128 kbps и receipt с исходным запросом и SHA-256 файлов. Он намеренно ограничен малыми дублями: speech до 5000 символов, design 100–1000, sfx до 450. Смешанным репликам не навязывается language_code=ru. Настройки дикции/произношения сверх этого узкого интерфейса требуют отдельного проверенного расширения helper, а не неявно проигнорированных полей.

Проверка helper без API и расходов: `node --test .agents/skills/dayenglish-voice-pipeline/scripts/elevenlabs.test.mjs`. Эти тесты используют имитацию транспорта, а не настоящие записи. После изменения API-helper запускать их отдельно: основной Vitest ищет тесты игры в src.

Для отдельно записываемых языковых сегментов speech поддерживает `languageCode: "en"` или `"ru"`, передаваемый как `language_code`; он входит в ключ кэша. Не применять ru ко всей смешанной реплике. Helper отклоняет это поле для multilingual_v2, где такой режим не поддерживается. [Контракт convert](https://elevenlabs.io/docs/api-reference/text-to-speech/convert). При проблеме с одиночным I сохранять английский текст и писать сегмент в режиме en, затем монтировать с русской частью тем же голосом; кириллическую запись произношения в учебный текст не добавлять.

Для синхронных субтитров speech поддерживает `"withTimestamps": true`: [официальный convert-with-timestamps](https://elevenlabs.io/docs/api-reference/text-to-speech/convert-with-timestamps). В этом режиме helper проверяет JSON с base64 MP3 и символьным alignment, сохраняет отдельный alignment.json и его SHA-256 в receipt. Повреждённый кэш не вызывает нового запроса. Теги подачи могут присутствовать в alignment: исключать их из отображаемого текста, сохраняя исходные индексы времени. Такие метки помогают монтажу, но не заменяют слуховую проверку синхронизации.

Кэш по нормализованному запросу: готовый неизменённый дубль повторно не запрашивается, целостность файлов проверяется. Каталог pending/failed означает, что запрос мог быть оплачен: автоматического повтора нет. Сначала проверить результат и историю провайдера; новый ID означает новый запрос и возможное списание. Не удалять такие receipts, чтобы скрыть неопределённость. Бинарная корректность результата не является проверкой звучания.

Коммерческое использование TTS требует подходящего платного плана: [условия billing](https://elevenlabs.io/docs/overview/administration/billing). В pricing на дату исследования Starter указан как $6/месяц после первого месяца, 30k credits; это не оценка цены всей главы. Повторные дубли и модели расходуют кредиты по-разному. Не приобретать подписку в рамках подготовки навыка.

Текущие API не следует смешивать: у Voice Design свои model IDs (`eleven_ttv_v3`), у speech — свои (`eleven_v4`/`eleven_v3`), у SFX — свои. [Модели](https://elevenlabs.io/docs/overview/models), [словарь произношения](https://elevenlabs.io/docs/eleven-api/guides/how-to/text-to-speech/pronunciation-dictionaries). Inline SSML не считать эквивалентом pronunciation dictionary.
