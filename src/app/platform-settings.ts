import { validateHostOrigin } from '../platform/dayenglish';
export function platformSettings() {
  const mode = import.meta.env.VITE_PLATFORM_MODE ?? 'standalone';
  if (mode === 'standalone')
    return { status: 'Пробный эпизод · прогресс пока не сохраняется' };
  const hostOrigin = import.meta.env.VITE_DAYENGLISH_HOST_ORIGIN;
  const gameId = import.meta.env.VITE_DAYENGLISH_GAME_ID;
  const releaseId = import.meta.env.VITE_DAYENGLISH_RELEASE_ID;
  try {
    if (mode !== 'dayenglish' || !hostOrigin || !gameId || !releaseId)
      throw new Error('Missing configuration');
    validateHostOrigin(hostOrigin);
    return {
      status: 'Подключение к DayEnglish…',
      options: { hostOrigin, gameId, releaseId },
    };
  } catch {
    return {
      status:
        'Ошибка настройки платформы. Проверьте .env.local по .env.example и перезапустите Vite.',
      invalid: true,
    };
  }
}
