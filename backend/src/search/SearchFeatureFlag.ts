import { createHash } from 'crypto';

export const isAdvancedSearchEnabled = (empresaId: number, sessionId = ''): boolean => {
  const percentage = Math.max(0, Math.min(100, Number(process.env.SEARCH_RANKING_PERCENTAGE || 0)));
  if (percentage === 0) return false;
  if (percentage === 100) return true;
  const digest = createHash('sha256').update(`${empresaId}:${sessionId || 'anonymous'}`).digest();
  return digest.readUInt32BE(0) % 100 < percentage;
};
