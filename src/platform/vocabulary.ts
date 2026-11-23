import { wordbook, type WordId } from '../domain/wordbook';

type CaptureStatus = 'pending' | 'saved' | 'existing' | 'cancelled' | 'error';
export type VocabularySnapshot = {
  availability:
    'standalone' | 'connecting' | 'ready' | 'unavailable' | 'closed';
  entries: Partial<Record<WordId, { status: CaptureStatus; message: string }>>;
};
type CapturePort = (payload: {
  term: string;
  translation: string;
  context: string;
}) => Promise<unknown>;
export function createVocabularyAccess(blocked: () => boolean) {
  let snapshot: VocabularySnapshot = {
    availability: 'standalone',
    entries: {},
  };
  const listeners = new Set<() => void>();
  let port: CapturePort | null = null;
  let epoch = 0;
  let pending: WordId | null = null;
  function publish(next: VocabularySnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }
  function entry(word: WordId, status: CaptureStatus, message: string) {
    publish({
      ...snapshot,
      entries: { ...snapshot.entries, [word]: { status, message } },
    });
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    bind(
      availability: VocabularySnapshot['availability'],
      capture: CapturePort | null = null,
    ) {
      epoch++;
      port = capture;
      if (pending) {
        entry(
          pending,
          'error',
          'Подтверждение прервано. Проверь словарь DayEnglish перед повтором.',
        );
        pending = null;
      }
      publish({ ...snapshot, availability });
    },
    async capture(word: WordId, context: string) {
      if (
        !port ||
        blocked() ||
        pending ||
        snapshot.availability !== 'ready' ||
        ['saved', 'existing'].includes(snapshot.entries[word]?.status ?? '')
      )
        return;
      const token = epoch;
      pending = word;
      entry(word, 'pending', 'Подтверди добавление в окне DayEnglish.');
      try {
        const result = await port({
          term: word,
          translation: wordbook[word].translation,
          context,
        });
        if (token !== epoch) return;
        if (
          !result ||
          typeof result !== 'object' ||
          !('status' in result) ||
          typeof result.status !== 'string' ||
          !['saved', 'existing', 'cancelled'].includes(String(result.status))
        )
          throw new Error('invalid_result');
        if (result.status === 'saved')
          entry(word, 'saved', 'Слово добавлено в словарь DayEnglish.');
        else if (result.status === 'existing')
          entry(word, 'existing', 'Это слово уже есть в словаре DayEnglish.');
        else
          entry(
            word,
            'cancelled',
            'Добавление отменено. Можно продолжить игру.',
          );
      } catch {
        if (token === epoch)
          entry(
            word,
            'error',
            'Не удалось подтвердить сохранение. Проверь словарь DayEnglish; затем можно повторить.',
          );
      } finally {
        if (token === epoch) pending = null;
      }
    },
  };
}
export type VocabularyAccess = ReturnType<typeof createVocabularyAccess>;
