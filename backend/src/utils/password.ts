import bcrypt from 'bcryptjs';

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

export const isBcryptHash = (hash: string): boolean => {
  return BCRYPT_PATTERN.test(hash);
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const oldPasswordHash = (password: string): string => {
  let nr = 1345345333n;
  let add = 7n;
  let nr2 = 0x12345671n;
  const mask = 0xffffffffn;

  for (const char of password) {
    if (char === ' ' || char === '\t') continue;

    const tmp = BigInt(char.codePointAt(0) || 0);
    nr ^= (((nr & 63n) + add) * tmp + (nr << 8n)) & mask;
    nr &= mask;
    nr2 += (nr2 << 8n) ^ nr;
    nr2 &= mask;
    add += tmp;
    add &= mask;
  }

  const part1 = (nr & 0x7fffffffn).toString(16).padStart(8, '0');
  const part2 = (nr2 & 0x7fffffffn).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
};

export const comparePassword = async (
  password: string,
  hash: string
): Promise<boolean> => {
  if (!hash) return false;

  if (isBcryptHash(hash)) {
    return bcrypt.compare(password, hash);
  }

  return oldPasswordHash(password) === hash.toLowerCase();
};
