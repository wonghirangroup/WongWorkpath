// Shared by anywhere a free-text field can hold either plain text or a real link (a meeting's
// location, "a physical place or an online meeting link" per its own field comment in types.ts)
// and needs to decide whether to render an <a> or plain text.
export function isUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
