// src/lib/tokenize.ts

const WORD_RE = /[а-яёa-z]+(?:-[а-яёa-z]+)*/gi;

export interface WordToken {
  /** Токен в нижнем регистре. */
  word: string;
  /** Токен в том виде, как он записан в тексте. */
  form: string;
  /** Порядковый номер токена в тексте. */
  index: number;
  /** Смещение токена в символах от начала текста. */
  position: number;
}

export function tokenizeWithPositions(text: string): WordToken[] {
  const tokens: WordToken[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text)) !== null) {
    tokens.push({
      word: m[0].toLowerCase(),
      form: m[0],
      index: tokens.length,
      position: m.index,
    });
  }
  return tokens;
}

export function tokenizeWords(text: string): string[] {
  return tokenizeWithPositions(text).map((t) => t.word);
}
