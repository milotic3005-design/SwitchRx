/**
 * The normalized URL when `url` is an absolute http(s) URL, otherwise null. Saved threads are read back
 * from localStorage and could have been edited, so a source's `url` is only linked after passing this.
 */
export function safeHttpUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch {
    return null;
  }
}
