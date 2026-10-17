import { safeMediaUrl } from './media-url'

/** Navigation is opt-in via a reader click; never accept executable protocols. */
export function safeLinkUrl(value: unknown): string | undefined {
  if (typeof value === 'string' && /^#[^\s\\\u0000-\u001f\u007f]{0,2047}$/.test(value)) return value
  return safeMediaUrl(value)
}
