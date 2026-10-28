/*
 * 판정 엔진 — 화면과 분리된 순수 계산 함수 모음
 * (브라우저에서는 window.Engine, Node에서는 require로 사용 → tools/test.js로 검증)
 */
(function (root) {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const fullText = (d) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}.(${WD[d.getDay()]}) ${hm(d)}`;
  const addMin = (d, m) => new Date(d.getTime() + m * 60000);

  function isHoliday(d, holidays, rules) {
    const day = d.getDay();
    if (day === 0 || day === 6) return true;
    if (holidays.has(ymd(d))) return true;
    const ld = rules.deadline.laborDay;
    return d.getMonth() + 1 === ld.month && d.getDate() === ld.day;
  }
  const isWeekday = (d, holidays) => d.getDay() !== 0 && d.getDay() !== 6 && !holidays.has(ymd(d));
  const within = (d, h) => d.getHours() >= h.start && d.getHours() < h.end;

  function nextBizMorning(d, holidays) {
    const n = new Date(d); n.setHours(9, 0, 0, 0);
    if (n <= d) n.setDate(n.getDate() + 1);
    while (!isWeekday(n, holidays)) n.setDate(n.getDate() + 1);
    return n;
  }

  /**
   * 장애 판정
   * input = { start: Date, services: [id], scope: id, full: bool, cause: id, media: bool }
   */
  function classify(input, rules, holidayList = []) {
    const holidays = new Set(holidayList);
    const svc = rules.services.filter((s) => input.services.includes(s.id));
    const has = (cat) => svc.some((s) => s.cat === cat);
    const critical = has('critical'), pub = critical || has('public');
    const d = input.start;
    const bizDay = isWeekday(d, holidays);
    const inBiz = bizDay && within(d, rules.businessHours);

    // 유형
    let type, why;
    if (!svc.length) { type = null; why = '안 되는 서비스를 하나 이상 고르세요.'; }
    else if (!inBiz) { type = 3; why = '업무시간 외 발생'; }
    else if (critical) { type = 1; why = '업무시간 내 중요 대민서비스 장애'; }
    else if (pub) { type = 2; why = '업무시간 내 기타 대민서비스 장애'; }
    else { type = 3; why = '내부 업무만 영향'; }

    // 장애등급(보정: 최대 2개 등급 하향)
    const notes = [];
    let down = 0;
    const gh = pub ? rules.gradeHours.public : rules.gradeHours.internal;
    if (!(bizDay && within(d, gh))) { down += 1; notes.push(`발생시간 보정(${pub ? '대국민 평일 09~21시' : '내부 평일 09~18시'} 외) −1`); }
    const sc = rules.scopes.find((s) => s.id === input.scope) || rules.scopes[0];
    if (sc.gradeDown) { down += sc.gradeDown; notes.push(`지역 보정(${sc.name}) −${sc.gradeDown}`); }
    down = Math.min(2, down);
    const grade = rules.system.baseGrade + down;

    // 비상대응
    let emergency = type ? rules.types[type].emergency : '';
    let escalateAt = null;
    if (type === 2) {
      const eod = new Date(d); eod.setHours(rules.type2Escalation.endOfDay, 0, 0, 0);
      const fourH = addMin(d, rules.type2Escalation.hours * 60);
      if (input.media) emergency = '언론 대응 필요 → 세제국 비상대응체계 즉시 가동';
      else if (fourH >= eod) emergency = '18시 임박 발생 → 세제국 비상대응체계 즉시 가동';
      else { escalateAt = fourH; emergency += ` → ${hm(fourH)}까지 미복구 시 비상대응체계 가동`; }
    }
    const afterHoursCritical = type === 3 && !inBiz && critical;
    const recheckAt = afterHoursCritical ? nextBizMorning(d, holidays) : null;
    if (afterHoursCritical) emergency += ` (다음 평일 ${fullText(recheckAt)}까지 미복구 시 유형1로 재판정)`;

    const notice = input.full
      ? ['즉시: 위택스 Sorry page', '30분 지속 시: 1시간 이내 기자단 문자', '필요시: 보도자료(기한연장)']
      : ['즉시: 위택스 공지사항·서비스별 팝업', '필요시: 보도자료(기한연장)'];

    const extra = [];
    if (input.cause === 'cyber') extra.push('사이버침해 의심: 디지털보안정책과 즉시 공유, 침해사고 신고(KISA 118·보호나라), 서버는 끄지 말고 외부 접속만 차단해 흔적 보존');
    if (input.cause === 'link') extra.push('연계 장애: 해당 연계기관에 원인·복구 예상시간 확인, 대체 처리 방법 안내');

    return {
      type, why, grade, gradeNotes: notes, emergency, escalateAt, recheckAt,
      report: type ? rules.types[type].report : '', notice, extra,
      critical, pub, inBiz, services: svc,
    };
  }

  /** 골든타임 타임라인 — 해당 조건의 단계만 골라 시각을 붙임 */
  function timeline(input, result, rules) {
    if (!result.type) return [];
    const t = result.type, d = input.start;
    const ok = (w) => ({
      t12: t === 1 || t === 2, t1: t === 1, t2: t === 2, t3: t === 3,
      full: input.full && t !== 3, partial: !input.full && t !== 3,
      g1: result.grade === 1 && t !== 3, cyber: input.cause === 'cyber',
      afterHoursCritical: !!result.recheckAt,
    })[w];
    const out = [];
    for (const s of rules.timeline) {
      if (!ok(s.when)) continue;
      let when;
      if (s.at === 'nextBiz') when = result.recheckAt;
      else if (s.clock != null) { when = new Date(d); when.setHours(s.clock, 0, 0, 0); if (when <= d) continue; }
      else when = addMin(d, s.at);
      out.push({ when, label: s.label, task: s.task, offset: Math.round((when - d) / 60000) });
    }
    return out.sort((a, b) => a.when - b.when);
  }

  /**
   * 기한 특례 계산(지방세기본법 §24)
   * ② 장애로 전자신고·납부를 못 한 경우 → 복구되어 할 수 있게 된 날의 다음 날
   * ① 그 날이 공휴일·토요일·근로자의 날이면 → 그 다음 날
   */
  function deadline(recovered, rules, holidayList = []) {
    const holidays = new Set(holidayList);
    const steps = [];
    const d = new Date(recovered); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
    steps.push(`§24② 복구일(${ymd(recovered)})의 다음 날 → ${ymd(d)}`);
    while (isHoliday(d, holidays, rules)) {
      const why = d.getDay() === 0 ? '일요일' : d.getDay() === 6 ? '토요일' : holidays.has(ymd(d)) ? '공휴일' : '근로자의 날';
      d.setDate(d.getDate() + 1);
      steps.push(`§24① ${why} → ${ymd(d)}`);
    }
    return { date: d, text: fullText(d).slice(0, -6), steps };
  }

  /** 문서 틀 채우기 */
  function fill(tpl, v) { return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (v[k] ?? '')); }

  /**
   * 일부 지자체 접속 불량 — 원인 분리
   * a = { central: 중앙 지표 정상(bool), others: 다른 시스템도 느림(bool), sameArea: 한 권역(bool), count: 신고 지자체 수 }
   */
  function diagnoseRegion(a, rules) {
    const r = rules.region;
    const cause = !a.central ? 'central' : a.others ? (a.sameArea ? 'area' : 'local') : 'client';
    const escalate = cause === 'central' || a.count >= r.escalateCount;
    const escalateWhy = cause === 'central' ? '중앙 지표 이상' : a.count >= r.escalateCount ? `${a.count}곳 동시 신고(기준 ${r.escalateCount}곳)` : '';
    return { cause, ...r.causes[cause], escalate, escalateWhy };
  }

  /** 버전 비교: '8u511', '11.0.33', '8.3.36' 모두 숫자 조각으로 비교 */
  const vparts = (v) => (String(v).match(/\d+/g) || []).map(Number);
  function vcmp(a, b) {
    const x = vparts(a), y = vparts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; }
    return 0;
  }

  /**
   * 권고문 ↔ 자산 대조
   * adv = { product, mode: 'fixed'|'upTo'|'temp'|'noDetail', lines:[{line, fixed|upTo}], supported:[...] }, item = { sw, version }
   * 반환: null(관계 없음) 또는 { hit: 'yes'|'check'|'no', why }
   */
  function matchAdvisory(adv, item) {
    if (adv.product !== item.sw) return null;
    if (!item.version) return { hit: 'check', why: '버전 미확인 — 먼저 확인 필요' };
    if (adv.mode === 'temp') return { hit: 'yes', why: '정식 패치 전 — 임시 조치 적용 필요' };
    if (adv.mode === 'noDetail') return { hit: 'check', why: '권고문 본문 확인 필요(영향 버전 미확인)' };
    const p = vparts(item.version);
    if (adv.mode === 'fixed') {
      const key = p[0] + '.' + p[1];
      const row = adv.lines.find((l) => l.line === key);
      if (!row) return vcmp(item.version, adv.lines[0].line) < 0 ? { hit: 'yes', why: '지원 종료 버전 — 지원 중인 버전으로 업그레이드' } : { hit: 'check', why: '권고문에 없는 버전 — 확인 필요' };
      return vcmp(item.version, row.fixed) < 0 ? { hit: 'yes', why: `${row.fixed} 이상으로 업데이트 필요` } : { hit: 'no', why: `${row.fixed} 이상 — 해결 버전${row.sunset ? ', ' + row.sunset : ''}` };
    }
    if (adv.mode === 'upTo') {
      const row = adv.lines.find((l) => l.line === String(p[0]));
      if (!row) return { hit: 'check', why: '권고문에 없는 버전 — 확인 필요' };
      return vcmp(item.version, row.upTo) <= 0 ? { hit: 'yes', why: `영향 버전(${row.upTo}) 이하 — 최신 보안 패치 적용 필요` } : { hit: 'no', why: `영향 버전(${row.upTo})보다 높음 — 패치 반영 여부 확인(TODO)` };
    }
    return null;
  }

  const api = { classify, timeline, deadline, fill, fullText, hm, ymd, addMin, diagnoseRegion, vcmp, matchAdvisory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
