export const MAX_MESSAGE_LENGTH = 4000;
const COUNTER_FROM = 3600;

export type MessageCheck =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" }
  | { ok: false; reason: "too_long"; excess: number };

/** Valida como o servidor: `trim` e `text.length` (UTF-16). */
export function validateMessage(raw: string): MessageCheck {
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: "empty" };
  if (text.length > MAX_MESSAGE_LENGTH) return { ok: false, reason: "too_long", excess: text.length - MAX_MESSAGE_LENGTH };
  return { ok: true, text };
}

export function showCounter(length: number): boolean {
  return length >= COUNTER_FROM;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: string): boolean {
  return UUID.test(value);
}
