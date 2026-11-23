// Spoken notation only. Displayed English, lesson rules and accepted answers stay exact.
export function bilingualSpeech(source) {
  if (
    source ===
    'He is not ready = He’s not ready = He isn’t ready. Isn’t сокращает is not. Выбери любую из этих форм.'
  )
    source =
      'He is not ready, He’s not ready и He isn’t ready означают одно и то же. Isn’t сокращает is not. Выбери любую из этих форм.';
  if (
    source ===
    'После гласной y сохраняется, добавляем только -s: key → keys. Подпиши пару ключей.'
  )
    source =
      'Если перед y стоит гласная буква, y сохраняется. Добавляем только -s: key → keys. Подпиши пару ключей.';
  const text = source
    .replace('В I am Marta', 'В предложении I am Marta')
    .replace(/\ba\/an\b/g, 'a или an')
    .replaceAll('→', ' превращается в ')
    .replaceAll('=', ' означает то же, что ')
    .replaceAll('+', ' плюс ')
    .replace(/\s*\/\s*/g, ', ')
    .replace(/([.!?])\s*,\s*/g, '$1 ')
    .replace(/апостроф/gi, (match) => match.slice(0, -1) + '\u0301ф');
  const letters = {
    x: '/ɛks/',
    y: '/waɪ/',
    r: '/ɑːr/',
    e: '/iː/',
    s: '/ɛs/',
    es: '/iː/ /ɛs/',
    ies: '/aɪ/ /iː/ /ɛs/',
    ys: '/waɪ/ /ɛs/',
  };
  return text
    .replace(/-?[A-Za-z]+(?:[’'][A-Za-z]+)?/g, (token, offset) => {
      const bare = token.replace(/^-/, '').toLowerCase();
      if (bare === 'i' || bare === 'a') {
        // I am / a robot remain complete English. A letter/list item gets its name.
        const englishContinuation = /^\s+[A-Za-z]/.test(
          text.slice(offset + token.length),
        );
        return englishContinuation ? token : bare === 'i' ? '/aɪ/' : '/eɪ/';
      }
      return letters[bare] ?? token;
    })
    .replace(/ {2,}/g, ' ');
}
