/*
 * 로컬 서버 — 화면 파일을 열어 주고, 공휴일 API를 대신 불러 줍니다.
 * 실행: node server.js  →  브라우저에서 http://localhost:3000
 * 인증키는 .env 파일에만 두고(깃허브에 올라가지 않음), 브라우저에는 노출하지 않습니다.
 * 별도 설치(npm install) 없이 Node.js 18 이상이면 동작합니다.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 3000;

// .env 읽기(간단 버전)
function readEnv() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch (e) { /* .env 없음 → 임시 데이터 사용 */ }
  return env;
}

const cache = {};
async function holidays(year) {
  if (cache[year]) return cache[year];
  const key = readEnv().HOLIDAY_API_KEY;
  if (!key) return { source: 'fallback', reason: '.env에 HOLIDAY_API_KEY가 없습니다' };
  const k = key.includes('%') ? key : encodeURIComponent(key); // Encoding·Decoding 키 모두 허용
  const url = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'
    + `?solYear=${year}&numOfRows=100&pageNo=1&_type=json&ServiceKey=${k}`;
  try {
    const r = await fetch(url);
    const text = await r.text();
    const j = JSON.parse(text); // 키 오류 시 XML이 와서 여기서 실패
    let items = j?.response?.body?.items?.item || [];
    if (!Array.isArray(items)) items = [items];
    const dates = items.filter((i) => i.isHoliday === 'Y').map((i) => {
      const s = String(i.locdate); return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    });
    cache[year] = { source: 'api', year, dates, names: items.map((i) => i.dateName) };
    return cache[year];
  } catch (e) {
    return { source: 'fallback', reason: '공휴일 API 응답 오류(인증키 등록 대기 중이거나 키 오류일 수 있음)' };
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/api/holidays') {
    const year = parseInt(u.searchParams.get('year'), 10) || new Date().getFullYear();
    const data = await holidays(year);
    res.writeHead(200, { 'Content-Type': TYPES['.json'] });
    return res.end(JSON.stringify(data));
  }
  const rel = decodeURIComponent(u.pathname === '/' ? '/index.html' : u.pathname);
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT) || path.basename(file).startsWith('.') || file.includes(`${path.sep}tools${path.sep}`)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}).listen(PORT, () => {
  const hasKey = !!readEnv().HOLIDAY_API_KEY;
  console.log(`\n  골든타임 알리미 실행 중 →  http://localhost:${PORT}`);
  console.log(`  공휴일 API: ${hasKey ? '인증키 확인됨' : '인증키 없음(임시 데이터 사용) — .env 파일을 만들어 주세요'}\n`);
});
