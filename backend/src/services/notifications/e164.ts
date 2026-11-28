const E164_STRICT_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Normalizes a WhatsApp / phone string into canonical E.164 format (`+<country><number>`).
 * Returns `null` when empty or invalid under strict E.164 bounds (8 to 15 digits after `+`).
 */
export function normalizeE164Phone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const cleaned = trimmed.replace(/[\s\-().]+/g, '');
  if (E164_STRICT_REGEX.test(cleaned)) {
    return cleaned;
  }

  // Normalize bare 10-digit Indian mobile numbers cleanly when prefixed fallback is needed
  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return null;
}

/**
 * Strict E.164 format predicate (`+<1-9><7-14 digits>`, ignoring whitespace/hyphens).
 */
export function isValidE164Phone(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const cleaned = raw.trim().replace(/[\s\-().]+/g, '');
  return E164_STRICT_REGEX.test(cleaned);
}
