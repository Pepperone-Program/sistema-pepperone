import 'dotenv/config';

const url = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '');
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const apply = process.argv.includes('--apply');
if (!url || !token) throw new Error('Configure UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN');

async function command<T>(args: string[]): Promise<T> {
  const response = await fetch(url!, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Upstash respondeu ${response.status}`);
  const body = await response.json() as { result?: T; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result as T;
}

async function main(): Promise<void> {
  let cursor = '0';
  let found = 0;
  let removed = 0;
  do {
    const [next, keys] = await command<[string, string[]]>(['SCAN', cursor, 'MATCH', 'site-pep:*', 'COUNT', '100']);
    cursor = next;
    const legacy = keys.filter((key) => key.startsWith('site-pep:') && !key.startsWith('site-pep:v2:'));
    found += legacy.length;
    if (apply) {
      for (let i = 0; i < legacy.length; i += 100) {
        removed += await command<number>(['UNLINK', ...legacy.slice(i, i + 100)]);
      }
    }
  } while (cursor !== '0');
  console.info({ legacyKeysFound: found, legacyKeysRemoved: removed, dryRun: !apply });
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
