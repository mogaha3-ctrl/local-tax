// 판정 엔진 검증: node tools/test.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const ctx = { window: {} };
for (const f of ['rules.js', 'holidays.js', 'advisories.js']) vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../data', f), 'utf8'), ctx);
const R = ctx.window.RULES, H = ctx.window.HOLIDAYS_FALLBACK[2026];
const E = require('../js/engine.js');
let fail = 0;
const check = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log(`${ok ? '✔' : '✘'} ${name}: ${got}${ok ? '' : ` (기대값 ${want})`}`); };
const c = (start, services, o = {}) => E.classify({ start: new Date(start), services, scope: 'national', full: false, cause: 'unknown', media: false, ...o }, R, H);

check('7.1. 09시 전국 신고·납부 불가 → 유형', c('2026-07-01T09:00', ['acq', 'pay']).type, 1);
check('같은 상황 → 등급', c('2026-07-01T09:00', ['acq', 'pay']).grade, 1);
check('평일 10시 환급만 불가 → 유형', c('2026-10-21T10:00', ['refund']).type, 2);
check('유형2 10시 발생 → 14:00 비상체계 기준', E.hm(c('2026-10-21T10:00', ['refund']).escalateAt), '14:00');
check('유형2 15시 발생 → 18시 임박 즉시 가동', c('2026-10-21T15:00', ['refund']).emergency.includes('18시 임박'), true);
check('토요일 10시 납부 불가 → 유형', c('2026-10-24T10:00', ['pay']).type, 3);
check('토요일 납부 불가 → 등급(시간 보정)', c('2026-10-24T10:00', ['pay']).grade, 2);
check('토요일 납부 불가 → 재판정 시각', E.fullText(c('2026-10-24T10:00', ['pay']).recheckAt), '2026.10.26.(월) 09:00');
check('평일 19시 납부 불가(대국민 21시 이전) → 등급', c('2026-10-21T19:00', ['pay']).grade, 1);
check('단일 지자체 + 평일 22시 → 등급(최대 2 하향)', c('2026-10-21T22:00', ['pay'], { scope: 'partial' }).grade, 3);
check('추석(9.25.) 10시 → 유형', c('2026-09-25T10:00', ['pay']).type, 3);
check('내부 업무만 평일 → 유형', c('2026-10-21T10:00', ['ledger']).type, 3);
check('기한: 10.23.(금) 복구 → 다음 날 토 → 월', E.ymd(E.deadline(new Date('2026-10-23T15:00'), R, H).date), '2026-10-26');
check('기한: 10.2.(금) 복구 → 토·일·대체공휴일(10.5.) → 10.6.', E.ymd(E.deadline(new Date('2026-10-02T15:00'), R, H).date), '2026-10-06');
check('기한: 4.30.(목) 복구 → 근로자의 날 → 5.4.(월)', E.ymd(E.deadline(new Date('2026-04-30T15:00'), R, H).date), '2026-05-04');
const tl = E.timeline({ start: new Date('2026-07-01T09:00'), full: true, cause: 'internal' }, c('2026-07-01T09:00', ['acq', 'pay'], { full: true }), R);
check('7.1. 타임라인 첫 단계 시각', E.hm(tl[0].when), '09:00');
check('7.1. 타임라인에 12시간(21:00) 포함', tl.some((s) => E.hm(s.when) === '21:00'), true);

// ── 지역 접속 불량 원인 분리 ──
const dr = (a) => E.diagnoseRegion({ central: true, others: true, sameArea: true, count: 4, ...a }, R);
check('중앙 정상 + 타 시스템도 느림 + 한 권역 → 권역 통신망', dr({}).cause, 'area');
check('중앙 정상 + 타 시스템도 느림 + 흩어짐 → 지자체 네트워크', dr({ sameArea: false }).cause, 'local');
check('중앙 정상 + 타 시스템 정상 → 단말·프로그램', dr({ others: false }).cause, 'client');
check('중앙 지표 이상 → 중앙 문제 + 격상', dr({ central: false }).cause + dr({ central: false }).escalate, 'centraltrue');
check('4곳 신고(기준 5곳) → 격상 아님', dr({}).escalate, false);
check('5곳 신고 → 격상 검토', dr({ count: 5 }).escalate, true);

// ── 권고문 대조 ──
const A = Object.fromEntries(ctx.window.ADVISORIES.map((a) => [a.id, a]));
const m = (id, sw, version) => (E.matchAdvisory(A[id], { sw, version }) || {}).hit;
check('버전 비교 8.3.36 > 8.3.35', E.vcmp('8.3.36', '8.3.35'), 1);
check('버전 비교 8u401 < 8u511', E.vcmp('8u401', '8u511'), -1);
check('PHP 8.3.30 (< 8.3.36) → 해당', m('php-urgent', 'php', '8.3.30'), 'yes');
check('PHP 8.4.28 (≥ 8.4.27) → 해당 없음', m('php-urgent', 'php', '8.4.28'), 'no');
check('PHP 8.1.30 지원 종료 → 해당', m('php-urgent', 'php', '8.1.30'), 'yes');
check('PHP 버전 미확인 → 확인 필요', m('php-urgent', 'php', ''), 'check');
check('PHP 임시 조치 권고 → 모든 PHP 해당', m('php-temp', 'php', '8.5.12'), 'yes');
check('Java 17.0.19 (≤ 17.0.21) → 해당', m('java', 'java', '17.0.19'), 'yes');
check('Java 21.0.14 (> 21.0.13) → 해당 없음', m('java', 'java', '21.0.14'), 'no');
check('Java 8u401 → 해당', m('java', 'java', '8u401'), 'yes');
check('Laravel 본문 미확인 → 확인 필요', m('laravel', 'laravel', '10.48'), 'check');
check('다른 제품은 대조 대상 아님', E.matchAdvisory(A.java, { sw: 'php', version: '8.3.30' }), null);
check('PHP 8.2.36 → 해결 버전이나 지원 종료 예정 안내', (E.matchAdvisory(A['php-urgent'], { sw: 'php', version: '8.2.36' }) || {}).why.includes('12.31.'), true);
check('PHP 8.2.34 → 해당', m('php-urgent', 'php', '8.2.34'), 'yes');
console.log(fail ? `\n${fail}건 실패` : '\n모두 통과');
process.exit(fail ? 1 : 0);
