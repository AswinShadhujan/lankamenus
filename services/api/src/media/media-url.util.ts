import { BadRequestException } from '@nestjs/common';

const MAX_URL_LEN = 2048;

/**
 * Validates and normalizes an external image URL for storage on media_assets.
 * HTTPS only, valid URL, bounded length (covers CDNs without file extensions in the path).
 */
export function validateExternalImageUrl(raw: string): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) {
    throw new BadRequestException('Image URL is required.');
  }
  if (trimmed.length > MAX_URL_LEN) {
    throw new BadRequestException(`Image URL must be at most ${MAX_URL_LEN} characters.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException('Image URL must be a valid URL (e.g. https://…).');
  }
  if (parsed.protocol !== 'https:') {
    throw new BadRequestException('Image URL must use https.');
  }
  if (!parsed.hostname || parsed.hostname.length < 3) {
    throw new BadRequestException('Image URL has an invalid host.');
  }
  return trimmed;
}
