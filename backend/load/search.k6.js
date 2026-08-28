import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    search: { executor: 'ramping-vus', stages: [
      { duration: '30s', target: Number(__ENV.SEARCH_VUS || 20) },
      { duration: '2m', target: Number(__ENV.SEARCH_VUS || 20) },
      { duration: '30s', target: 0 },
    ] },
  },
  thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<500', 'p(99)<1000'] },
};

const queries = ['garrafa','garrafa inox','garrafa termica','garrafa parede dupla','garrafa termica inox 500ml',
  'caneta','caneta metalica','bloco','bloco com pauta','kit executivo','copo termico','mochila notebook'];

export default function () {
  const baseUrl = __ENV.SEARCH_BASE_URL || 'http://localhost:3001';
  const empresaId = __ENV.SEARCH_EMPRESA_ID || '1';
  const query = queries[Math.floor(Math.random() * queries.length)];
  const response = http.get(`${baseUrl}/api/v1/produtos/site/busca?empresaId=${empresaId}&limit=20&q=${encodeURIComponent(query)}`,
    { headers: { 'X-Search-Session-Id': `k6-${__VU}` } });
  check(response, { 'status 200': (item) => item.status === 200, 'json success': (item) => item.json('success') === true });
  sleep(0.2);
}
