import type { LevelDefinition } from './levels';

export const pluralRule =
  'Apple — одно яблоко, apples — яблоки. Egg — одно яйцо, eggs — яйца. Окончание -s здесь показывает множественное число. A и an с этими формами не ставим: a apples и an eggs — ошибки. Когда в нашей просьбе нужны просто яблоки, без выбора конкретных, можно сказать apples. Артикля нет — это называют нулевым артиклем. Если мы оба понимаем, какие яблоки нужны, говорим the apples. The подходит и для одного предмета, и для нескольких. Это не правило «перед множественным числом всегда пусто»: выбор зависит от смысла.';

export function createPluralPractice(
  continuation: LevelDefinition,
): LevelDefinition {
  function part(
    noun: 'apples' | 'eggs',
    known: boolean,
    next: LevelDefinition,
  ): LevelDefinition {
    const apple = noun === 'apples';
    const number = (apple ? 1 : 3) + Number(known);
    const group = apple ? 'plural-apples' : 'plural-eggs';
    const label = apple ? 'Два яблока' : 'Два яйца';
    const name = apple ? 'яблоки' : 'яйца';
    return {
      id: `chapter-01-12-plural-${number}`,
      revision: 1,
      columns: 7,
      rows: 4,
      walls: [{ x: 6, y: 0 }],
      slots: [
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
      optionalLeadingArticle: true,
      start: { x: 4, y: 3 },
      pieces: [
        { id: 'a', kind: 'word', word: 'a', x: 1, y: 1 },
        { id: 'an', kind: 'word', word: 'an', x: 3, y: 1 },
        { id: 'the', kind: 'word', word: 'the', x: 5, y: 1 },
        { id: noun, kind: 'word', word: noun, x: 4, y: 2 },
      ],
      reference: {
        objects: ['слева', 'посередине', 'справа'].map((position, index) => ({
          id: `${group}-${index}`,
          noun,
          count: 2,
          label: `${label} ${position}`,
        })),
        indicatedId: null,
        markerLabel: 'Наш выбор',
      },
      carryReference: known,
      answers: [
        {
          words: known ? ['the', noun] : [noun],
          goal: true,
          effect: {
            type: known ? 'deliver' : 'select',
            target: known ? 'known' : 'any',
            destination: 'bag',
          },
        },
        {
          words: known ? [noun] : ['the', noun],
          goal: false,
          feedback: known
            ? `${noun} — правильное слово. Но сейчас просим именно отложенные ${name}: the ${noun}.`
            : `The ${noun} означает конкретные ${name}. Мы ещё не выбрали их, подойдут любые. В этой просьбе достаточно ${noun}, без артикля.`,
        },
      ],
      mistakes: ['a', 'an'].map((article) => ({
        words: [article, noun],
        reason: 'article',
        feedback: `${noun} — множественное число. ${article} с ним не ставим. Реши, нужны любые ${name} или именно те, которые мы уже выбрали.`,
      })),
      presentation: {
        title: `${known ? 'Та самая пара' : apple ? 'Яблоки для перекуса' : 'Яйца для попутчиков'} · ${number} из 7`,
        noun,
        quest: known
          ? `Попроси положить в сумку те ${name}, которые кот только что отложил.`
          : `Попроси отложить ${name} для попутчиков. Подойдут любые; кот выберет пару.`,
        introduction: known
          ? [
              `Я отложил пару. Ты видел, какие ${name} я выбрал. Теперь попроси положить именно их в сумку.`,
              ...(apple
                ? [
                    'The можно поставить и перед множественным числом: the apples — те яблоки, о которых мы говорим.',
                  ]
                : []),
            ]
          : apple
            ? [
                'Чуть не забыли перекус для попутчиков! Им нужны яблоки. Какие именно — не важно.',
                'Apple — одно яблоко, apples — яблоки. Окончание -s показывает, что их несколько. A и an с множественным числом не ставим.',
                'Здесь можно попросить просто apples. Артикля нет — это называют нулевым артиклем. Он подходит для этой просьбы о любых яблоках; позже мы сравним её с просьбой о конкретных.',
                'Поставь apples в правую клетку рамки. Левую можно оставить пустой: таблички «пусто» не нужно. Я отложу пару яблок.',
              ]
            : [
                'Яблоки собраны. Ещё отложим яйца для попутчиков — любые из тех, что на стойке.',
                'Egg — одно яйцо, eggs — яйца. Здесь тоже есть окончание -s. Собери просьбу сам: артикль можно поставить слева или оставить это место пустым.',
              ],
        success: known
          ? [
              `Отложенные ${name} в сумке. Остальные остались на стойке.`,
              ...(apple
                ? ['Теперь попробуем с другим словом.']
                : [
                    'С несколькими предметами тоже разобрались. Остались три знакомые просьбы перед выходом.',
                  ]),
            ]
          : [
              `Вот выбранная пара. Теперь попроси положить в сумку именно эти ${name}.`,
            ],
        rule: pluralRule,
        hint: known
          ? `Нужно the ${noun}. Из начального положения: ↑ ↑ ↓ → → ↑ ← ← ↓ ← ↑. Если уже сделал другие ходы, сначала отмени их.`
          : `Нужно только ${noun}, без артикля. Из начального положения: ↑ ↑. Левую клетку рамки оставь пустой.`,
        destination: 'bag',
      },
      continuation: next,
    };
  }
  return part(
    'apples',
    false,
    part('apples', true, part('eggs', false, part('eggs', true, continuation))),
  );
}
