import { createHmac, timingSafeEqual } from 'crypto';
import type { SearchCursor } from '@/types/search';

const secret = (): string => process.env.SEARCH_CURSOR_SECRET || process.env.SITE_TOKEN_SECRET || process.env.JWT_SECRET || 'development-only-search-secret';
const sign = (payload: string): string => createHmac('sha256', secret()).update(payload).digest('base64url');

export const encodeSearchCursor = (cursor: SearchCursor): string => {
  const payload = Buffer.from(JSON.stringify(cursor)).toString('base64url');
  return `${payload}.${sign(payload)}`;
};

export const decodeSearchCursor = (cursor: string): SearchCursor | null => {
  const [payload, signature] = cursor.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SearchCursor; } catch { return null; }
};
