/* 화면 동작 — 판정 계산은 engine.js, 기준값은 data/*.js 에 있습니다. */
(function () {
  const R = window.RULES, E = window.Engine, S = window.SCENARIOS;
  const $ = (id) => document.getElementById(id);
  const LABEL = { ok: '정상', warn: '주의', bad: '장애', threat: '외부 위협' };
  const ICON = { ok: '●', warn: '▲', bad: '■', threat: '◆' };
  const TILE_TXT = { ok: '정상', warn: '지연', bad: '이용 불가', threat: '주의' };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const store = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };

  // ── 공휴일: 서버(API)가 있으면 사용, 없으면 임시 데이터 ──
  const holidayCache = {};
  function holidays(year) { return holidayCache[year] || (window.HOLIDAYS_FALLBACK[year] || []); }
  async function loadHolidays(year) {
    if (holidayCache[year] || !location.protocol.startsWith('http')) return;
    try {
      const r = await fetch(`/api/holidays?year=${year}`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (Array.isArray(j.dates) && j.source === 'api') { holidayCache[year] = j.dates; $('holidaySrc').textContent = '한국천문연구원 특일정보 API'; }
    } catch (e) { /* 임시 데이터 유지 */ }
  }
  const hol = (d) => holidays(d.getFullYear()).concat(holidays(d.getFullYear() + 1));

  // ── 공통: 이용자 추이 스파크라인(가상) ──
  function curve(kind) {
    const pts = [];
    for (let h = 0; h <= 15.17; h += 0.25) {
      const am = Math.exp(-((h - 10.3) ** 2) / 2.2), pm = Math.exp(-((h - 14.8) ** 2) / 3);
      let v = 0.04 + 0.9 * Math.max(am, pm * 0.97) - (h > 12 && h < 13.2 ? 0.25 * Math.sin((h - 12) / 1.2 * Math.PI) : 0);
      if (kind.endsWith('Out') && h >= 9) v = h < 9.5 ? v * 1.6 : v * (kind === 'pubOut' ? 1.9 : 1.05);
      pts.push([h, Math.min(Math.max(v, 0.02), 1.15)]);
    }
    return pts;
  }
  function spark(kind, level) {
    const W = 420, H = 90, L = 8, Rr = 8, T = 8, B = 18, x = (h) => L + (W - L - Rr) * h / 24, y = (v) => T + (H - T - B) * (1 - v / 1.2);
    const p = curve(kind), line = p.map((q, i) => (i ? 'L' : 'M') + x(q[0]).toFixed(1) + ' ' + y(q[1]).toFixed(1)).join(' ');
    const last = p[p.length - 1], col = `var(--${level === 'ok' ? 'accent' : level})`;
    const grid = [0, 6, 12, 18, 24].map((h) => `<line x1="${x(h)}" x2="${x(h)}" y1="${T}" y2="${H - B}" stroke="var(--line)"/><text x="${x(h)}" y="${H - 4}" font-size="10" fill="var(--muted)" text-anchor="${h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}">${h}시</text>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="오늘 이용자 추이">${grid}<path d="${line} L ${x(last[0])} ${y(0)} L ${x(0)} ${y(0)} Z" fill="${col}" opacity=".14"/><path d="${line}" fill="none" stroke="${col}" stroke-width="2"/><circle cx="${x(last[0])}" cy="${y(last[1])}" r="4" fill="${col}"/></svg>`;
  }

  // ── 공통: 문서 탭 ──
  function docsHTML(key, docs) {
    return `<div class="docs" data-docs="${key}"><div class="doctabs" role="group" aria-label="자동 작성 문서">${docs.map((d, i) => `<button type="button" data-i="${i}" aria-pressed="${i === 0}">${esc(d.name)}</button>`).join('')}</div>
      <div class="docbody"><div class="ptitle"><span class="who" data-to></span><button type="button" class="copy">복사</button></div><pre data-pre></pre></div></div>`;
  }
  // 문서 영역을 한 번만 연결하고, 이후에는 내용만 바꿈(중복 이벤트 방지)
  function setDocs(root, key, docs) {
    let box = root.querySelector('.docs');
    if (!box._bound || box.querySelectorAll('.doctabs button').length !== docs.length) {
      const cur = +(box.dataset.cur || 0);
      box.outerHTML = docsHTML(key, docs);
      box = root.querySelector('.docs'); box.dataset.cur = cur < docs.length ? cur : 0; box._bound = true;
      box.querySelectorAll('.doctabs button').forEach((b) => b.addEventListener('click', () => { box.dataset.cur = b.dataset.i; paint(); }));
      box.querySelector('.copy').addEventListener('click', async (e) => {
        const pre = box.querySelector('[data-pre]');
        try { await navigator.clipboard.writeText(pre.textContent); e.target.textContent = '복사됨'; }
        catch (err) { const r = document.createRange(); r.selectNodeContents(pre); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); e.target.textContent = '선택됨 · Ctrl+C'; }
        setTimeout(() => (e.target.textContent = '복사'), 1800);
      });
    }
    box._docs = docs;
    function paint() {
      const i = +box.dataset.cur, d = box._docs[i];
      box.querySelectorAll('.doctabs button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.i === i)));
      box.querySelector('[data-to]').textContent = '받는 곳: ' + d.to;
      box.querySelector('[data-pre]').textContent = d.text;
    }
    paint();
  }

  // ── 골든타임 패널(상황판·장애 접수 공용) ──
  const CAUSE_PUBLIC = { unknown: '장애', internal: '시스템 오류', infra: '기반시설 장애', cyber: '보안 점검', link: '연계기관 시스템 장애' };
  function docValues(input, res, elapsed) {
    const svcNames = res.services.map((s) => s.name).join('·');
    const actions = [`위택스 ${input.full ? 'Sorry page' : '공지·팝업'} 안내`, 'KLID 장애 공유방 가동', '지방정부 상황 전파'];
    if (input.full && elapsed >= 30) actions.push('기자단 문자 전파');
    if (res.type === 1 && elapsed >= 60) actions.push('세목별 대응 매뉴얼 시행');
    const cause = R.causes.find((c) => c.id === input.cause);
    return {
      system: R.system.name, url: R.system.url, owner: R.system.owner, serverLocation: R.system.serverLocation,
      grade: res.grade, typeName: R.types[res.type].name, typeDesc: res.why,
      startText: E.fullText(input.start), startShort: E.fullText(input.start).slice(5), startClock: E.hm(input.start),
      services: svcNames, impactShort: res.pub ? '위택스 대민서비스(' + svcNames + ')' : '내부 업무(' + svcNames + ')',
      cause: input.cause === 'unknown' ? '확인 중' : cause.name, causePublic: CAUSE_PUBLIC[input.cause],
      actions: actions.join(', '),
      altGuide: res.critical ? '• 긴급한 경우 : 관할 지방자치단체 세무부서에서 처리\n' : '',
    };
  }
  function renderGolden(el, input, startElapsed) {
    const res = E.classify(input, R, hol(input.start));
    if (!res.type) { el.hidden = true; return res; }
    const steps = E.timeline(input, res, R);
    const max = Math.max(780, ...steps.map((s) => s.offset + 30));
    const tone = res.type === 1 ? 'bad' : res.type === 2 ? 'warn' : 'ok';
    el.hidden = false;
    el.className = 'panel s-' + tone;
    el.innerHTML = `<div class="ptitle"><h3>골든타임 — 지금 해야 할 일</h3><span class="who">「장애발생 시 비상대응 매뉴얼」(2026.10.) 기준</span></div>
      <div class="gt-head"><span class="badge">${R.types[res.type].name} · ${res.grade}등급 · ${input.full ? '전체 장애' : '일부 장애'}</span>
        <span>경과 <span class="clock" data-clock>0:00</span></span>
        <div class="slider"><label for="${el.id}-el">발생(${E.hm(input.start)}) 후 경과 시간을 움직여 보세요</label><input type="range" id="${el.id}-el" min="0" max="${max}" step="5" value="${Math.min(startElapsed, max)}"></div></div>
      <ul class="steps" data-steps></ul>${docsHTML(el.id, [])}`;
    const range = el.querySelector('input[type=range]');
    const draw = () => {
      const e = +range.value, fmt = (m) => Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
      el.querySelector('[data-clock]').textContent = fmt(e);
      let nowIdx = -1; steps.forEach((s, i) => { if (e >= s.offset) nowIdx = i; });
      const lastOffset = nowIdx >= 0 ? steps[nowIdx].offset : -1;
      el.querySelector('[data-steps]').innerHTML = steps.map((s) => {
        const cls = s.offset < lastOffset ? 'done' : s.offset === lastOffset ? 'now' : 'next';
        const st = cls === 'done' ? '시점 지남' : cls === 'now' ? '지금 할 일' : `${fmt(s.offset - e)} 남음`;
        return `<li class="${cls}"><span class="t">${E.hm(s.when)}<br><small>${esc(s.label)}</small></span><span>${esc(s.task)}</span><span class="st">${st}</span></li>`;
      }).join('');
      const v = docValues(input, res, e);
      const docs = window.TEMPLATES.filter((t) => (t.id !== 'press' || input.full) && (t.id !== 'dsc' || res.type !== 3))
        .map((t) => ({ name: t.name, to: t.to, text: E.fill(t.body, v) }));
      setDocs(el, el.id, docs);
    };
    range.addEventListener('input', draw);
    draw();
    return res;
  }

  // ── 외부 위협 패널 ──
  const threatState = {};
  function renderThreat(sc) {
    const el = $('threatPanel'), t = sc.threat;
    const st = (threatState[sc.tab] = threatState[sc.tab] || {});
    el.hidden = false;
    const ASSET = { ok: '정상', warn: '점검 필요', bad: '목록 미등록' };
    const assets = t.assets ? `<div style="margin-top:16px"><div class="ptitle"><b style="font-size:.9rem">위성 시스템 점검판 — 외부에 열린 서비스 전체</b><span class="who">가상 예시 · 실제 점검 결과 아님</span></div>
      <div class="tbl"><table><thead><tr><th>서비스</th><th>이용자</th><th>로그인 방식</th><th>최근 점검</th><th>상태</th></tr></thead><tbody>
      ${t.assets.map((a) => `<tr><td style="font-family:var(--font);color:var(--ink)">${esc(a[0])}</td><td>${esc(a[1])}</td><td>${esc(a[2])}</td><td>${esc(a[3])}</td><td><span class="pill s-${a[4] === 'bad' ? 'bad' : a[4]}">${ICON[a[4]]} ${esc(a[5] || ASSET[a[4]])}</span></td></tr>`).join('')}
      </tbody></table></div></div>` : '';
    let breachCard = '';
    if (t.breach) {
      const d0 = new Date(t.breach.detected), d72 = E.addMin(d0, 72 * 60);
      breachCard = `<div class="facts-grid" style="margin-top:12px">
        <div class="fact"><div class="l">이상 징후 감지</div><div class="v">${E.fullText(d0)}</div><small>로그인 실패 급증 경보</small></div>
        <div class="fact" style="background:var(--bad-bg)"><div class="l">유출이 확인되면 — 통지·신고 골든타임 72시간</div><div class="v" style="color:var(--bad)">${E.fullText(d72)}까지</div><small>개인정보 보호법 §34 · 유출 인지 시점부터 기산(TODO 확인)</small></div></div>`;
    }
    el.innerHTML = `<div class="ptitle"><h3>외부 위협 — 사전 점검</h3><span class="pill">◆ ${esc(t.name)}</span></div>
      <ul class="facts">${t.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>${breachCard}
      <div class="grid2" style="gap:14px;margin-top:12px"><div><b style="font-size:.9rem">점검 항목</b>
        <div class="progress" aria-hidden="true"><i data-bar></i></div><div class="who" data-count></div>
        <ul class="checks" style="margin-top:8px">${t.checklist.map((c, i) => `<li><label><input type="checkbox" id="chk-${i}" ${st[i] ? 'checked' : ''}><span>${esc(c)}</span></label></li>`).join('')}</ul></div>
      <div><b style="font-size:.9rem">바로 쓰는 문서</b>${docsHTML('threat', [])}</div></div>${assets}`;
    const draw = () => {
      const done = t.checklist.filter((_, i) => st[i]).length;
      el.querySelector('[data-bar]').style.width = (done / t.checklist.length * 100) + '%';
      el.querySelector('[data-count]').textContent = `${done} / ${t.checklist.length} 완료`;
      const stopTo = new Date('2026-10-23T06:00');
      const v = { threat: t.name, replyBy: '18:00', stopFrom: '10.22.(목) 22:00', stopTo: '10.23.(금) 06:00',
        extendTo: E.deadline(stopTo, R, hol(stopTo)).text, done, total: t.checklist.length,
        detected: t.breach ? E.fullText(new Date(t.breach.detected)) : '',
        deadline72: t.breach ? E.fullText(E.addMin(new Date(t.breach.detected), 72 * 60)) : '' };
      const list = window.THREAT_TEMPLATES.filter((d) => (t.docs ? t.docs.includes(d.id) : !d.only));
      setDocs(el, 'threat', list.map((d) => ({ name: d.name, to: d.to, text: E.fill(d.body, v) })));
    };
    t.checklist.forEach((_, i) => $('chk-' + i).addEventListener('change', (e) => { st[i] = e.target.checked; draw(); }));
    draw();
  }

  // ── 일부 지자체 접속 불량: 접수 현황 + 원인 분리 3문항 + 문서 ──
  const regionState = {};
  function renderRegion(sc) {
    const el = $('regionPanel'), g = sc.region, Q = R.region.questions;
    const st = (regionState[sc.tab] = regionState[sc.tab] || { ...g.defaults });
    const now = new Date(g.now);
    const reps = g.reports.map((r) => ({ name: r[0], at: new Date(r[1]), symptom: r[2], lv: r[3], state: r[4], repeat: r[5] }));
    const first = reps.reduce((a, r) => (r.at < a ? r.at : a), reps[0].at);
    const mins = Math.round((now - first) / 60000), elapsed = `${Math.floor(mins / 60)}시간 ${mins % 60}분`;
    const okCount = reps.filter((r) => r.lv === 'ok').length;
    el.hidden = false;
    el.innerHTML = `<div class="ptitle"><h3>일부 지자체 접속 불량 — 중앙 문제인가, 지자체 쪽인가?</h3><span class="pill">▲ 원인 분리 중</span></div>
      <div class="facts-grid">
        <div class="fact"><div class="l">최초 접수</div><div class="v">${E.hm(first)}</div><small>${reps.length}곳 신고</small></div>
        <div class="fact"><div class="l">접수 후 경과</div><div class="v">${elapsed}</div><small>${E.hm(now)} 기준</small></div>
        <div class="fact"><div class="l">정상 확인</div><div class="v">${okCount} / ${reps.length}곳</div><small>나머지는 확인·처리 중</small></div>
        <div class="fact" style="background:var(--warn-bg)"><div class="l">반복 신고</div><div class="v">${reps.filter((r) => r.repeat).length}곳</div><small>${esc(g.priorNote)}</small></div>
      </div>
      <div class="tbl"><table><thead><tr><th>지자체</th><th>최초 접수</th><th>증상</th><th>상태</th></tr></thead><tbody>
        ${reps.map((r) => `<tr><td style="font-family:var(--font);color:var(--ink)">${esc(r.name)}${r.repeat ? ' <small>↻ 반복</small>' : ''}</td><td>${E.hm(r.at)}</td><td style="font-family:var(--font)">${esc(r.symptom)}</td><td><span class="pill s-${r.lv}">${ICON[r.lv]} ${esc(r.state)}</span></td></tr>`).join('')}
      </tbody></table></div>
      <div class="grid2" style="gap:14px;margin-top:14px">
        <div><b style="font-size:.9rem">원인 가르기 — 세 가지만 답하세요</b>
          <div style="display:grid;gap:8px;margin-top:8px">${Q.map((q) => `<fieldset style="border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin:0"><legend style="font-size:.85rem;font-weight:600;padding:0 4px">${esc(q.q)}</legend>
            <div class="hint">${esc(q.hint)}</div>
            <div style="display:flex;gap:16px;margin-top:4px"><label class="opt"><input type="radio" name="rq-${q.id}" value="1" ${st[q.id] ? 'checked' : ''}><span>예</span></label><label class="opt"><input type="radio" name="rq-${q.id}" value="0" ${st[q.id] ? '' : 'checked'}><span>아니오</span></label></div></fieldset>`).join('')}</div>
          <div id="regionVerdict" style="margin-top:10px"></div></div>
        <div><b style="font-size:.9rem">바로 쓰는 문서</b>${docsHTML('region', [])}</div>
      </div>`;
    const draw = () => {
      const d = E.diagnoseRegion({ ...st, count: reps.length }, R);
      const left = R.region.escalateCount - reps.length;
      const escText = d.escalate ? `격상 검토 — ${d.escalateWhy}. 장애 접수 화면에서 유형을 판정하세요.`
        : `해당 없음 — 신고 ${reps.length}곳(기준 ${R.region.escalateCount}곳), 중앙 지표 정상. ${left}곳 더 늘거나 중앙 지표가 이상이면 격상 검토`;
      el.querySelector('#regionVerdict').innerHTML = `<div class="warnbox" style="border-left-color:var(--${d.cause === 'central' ? 'bad' : 'warn'});background:var(--${d.cause === 'central' ? 'bad' : 'warn'}-bg)">
        <b>판단: ${esc(d.name)}</b><br>연락할 곳: ${esc(d.who)}<br>${esc(d.action)}<br><small>${esc(escText)}</small>
        ${d.escalate ? '<div style="margin-top:8px"><button type="button" class="tabs-go" id="regionGo">장애 접수 화면으로</button></div>' : ''}</div>`;
      const go = el.querySelector('#regionGo'); if (go) go.addEventListener('click', () => show('intake'));
      const v = { who: d.who, causeName: d.name, ask: d.ask, firstReport: E.hm(first), areas: reps.map((r) => r.name).join('·'), count: reps.length, elapsed,
        centralText: st.central ? '정상' : '이상 징후', othersText: st.others ? '해당 지자체의 다른 시스템도 느림' : '다른 시스템은 정상',
        okCount, pendingCount: reps.length - okCount, escalateText: escText };
      setDocs(el, 'region', window.REGION_TEMPLATES.map((t) => ({ name: t.name, to: E.fill(t.to, v), text: E.fill(t.body, v) })));
    };
    Q.forEach((q) => el.querySelectorAll(`input[name="rq-${q.id}"]`).forEach((r) => r.addEventListener('change', (e) => { st[q.id] = e.target.value === '1'; draw(); })));
    draw();
  }

  // ── 권고문 대조: 가상 자산 대장과 권고문 영향 버전을 비교 ──
  const advState = { run: false };
  const HIT = { yes: ['bad', '해당 가능'], check: ['warn', '확인 필요'], no: ['ok', '해당 없음'] };
  function advRows() {
    const rows = [];
    window.ADVISORIES.forEach((a) => window.INVENTORY.forEach((it) => {
      const m = E.matchAdvisory(a, { sw: it[2], version: it[3] });
      if (m) rows.push({ a, it, m });
    }));
    const order = { yes: 0, check: 1, no: 2 };
    return rows.sort((x, y) => order[x.m.hit] - order[y.m.hit]);
  }
  function renderAdvisory() {
    const A = window.ADVISORIES, N = window.SW_NAME, rows = advRows();
    // 시스템 단위 집계: 한 시스템에 여러 권고문이 걸리면 가장 심각한 판정 하나로 센다
    const sysHit = {}; const rank = { yes: 0, check: 1, no: 2 };
    rows.forEach((r) => { const k = r.it[0]; if (!(k in sysHit) || rank[r.m.hit] < rank[sysHit[k]]) sysHit[k] = r.m.hit; });
    const cnt = (k) => Object.values(sysHit).filter((h) => h === k).length;
    $('advMail').innerHTML = `<div class="tbl"><table><thead><tr><th>수신 권고문</th><th>출처 · 일자</th><th>핵심</th>${advState.run ? '<th>우리 시스템</th>' : ''}</tr></thead><tbody>
      ${A.map((a) => { const mine = rows.filter((r) => r.a.id === a.id), y = mine.filter((r) => r.m.hit === 'yes').length, c = mine.filter((r) => r.m.hit === 'check').length;
        return `<tr><td style="font-family:var(--font);color:var(--ink)">${esc(a.title)}</td><td>${esc(a.src)} · ${a.date}</td><td style="font-family:var(--font)">${esc(a.note)}</td>${advState.run ? `<td><span class="pill s-${y ? 'bad' : c ? 'warn' : 'ok'}">${y ? ICON.bad + ' 해당 가능 ' + y + '곳' : c ? ICON.warn + ' 확인 필요 ' + c + '곳' : ICON.ok + ' 해당 없음'}</span></td>` : ''}</tr>`; }).join('')}
      </tbody></table></div>`;
    const box = $('advResult'); box.hidden = !advState.run;
    if (!advState.run) return;
    const line = (r, i) => ` ${i + 1}. ${r.it[0]} — ${N[r.it[2]]} ${r.it[3] || '버전 미확인'} : ${r.a.title} → ${r.m.why}`;
    const hits = rows.filter((r) => r.m.hit !== 'no');
    const top = rows.filter((r) => r.m.hit === 'yes').slice(0, 3).map((r) => `${r.it[0]}(${N[r.it[2]]} ${r.it[3]})`);
    box.innerHTML = `<div class="ptitle"><h3>대조 결과</h3><span class="who">권고문 ${A.length}건 × 소관 시스템 ${Object.keys(sysHit).length}곳</span></div>
      <div class="facts-grid">
        <div class="fact" style="background:var(--bad-bg)"><div class="l">${ICON.bad} 해당 가능 — 바로 조치</div><div class="v" style="color:var(--bad)">${cnt('yes')}곳</div></div>
        <div class="fact" style="background:var(--warn-bg)"><div class="l">${ICON.warn} 확인 필요 — 버전·본문 확인</div><div class="v" style="color:var(--warn)">${cnt('check')}곳</div></div>
        <div class="fact"><div class="l">${ICON.ok} 해당 없음</div><div class="v">${cnt('no')}곳</div></div></div>
      <div class="tbl"><table><thead><tr><th>시스템</th><th>구분</th><th>소프트웨어 · 버전</th><th>권고문</th><th>판정</th><th>조치</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td style="font-family:var(--font);color:var(--ink)">${esc(r.it[0])}</td><td>${esc(r.it[1])}</td><td>${N[r.it[2]]} ${esc(r.it[3] || '미확인')}</td><td style="font-family:var(--font)">${esc(r.a.title)}</td>
          <td><span class="pill s-${HIT[r.m.hit][0]}">${ICON[HIT[r.m.hit][0]]} ${HIT[r.m.hit][1]}</span></td><td style="font-family:var(--font)">${esc(r.m.why)}</td></tr>`).join('')}
      </tbody></table></div>
      <div style="margin-top:14px"><b style="font-size:.9rem">바로 쓰는 문서</b>${docsHTML('advisory', [])}</div>
      <div class="hint" style="margin-top:10px">※ 자산 대장·버전은 가상 예시입니다. PHP 영향 버전은 KISA 안내(FAQ)와 일치함을 확인했고, Java 등은 공문에서 읽은 값이라 원문 확인이 필요합니다(TODO). 실제 도입 시 자산 대장을 연결하고, 영향 버전보다 높은 경우도 패치 반영 여부를 확인하세요.</div>`;
    const v = { advCount: A.length, advList: A.map((a) => ` - ${a.title}(${a.src}, ${a.date})`).join('\n'), hitCount: hits.length, sysHit: cnt('yes') + cnt('check'), hitList: hits.map(line).join('\n'),
      yesCount: cnt('yes'), checkCount: cnt('check'), noCount: cnt('no'), topList: top.length ? top.join(', ') : '해당 없음' };
    setDocs(box, 'advisory', window.ADVISORY_TEMPLATES.map((t) => ({ name: t.name, to: t.to, text: E.fill(t.body, v) })));
  }
  function runAdvisory() {
    advState.run = true; renderAdvisory();
    // 시스템 단위로 집계(한 시스템에 여러 권고문이 걸리면 가장 심각한 판정 하나)
    const rank = { yes: 0, check: 1, no: 2 }, sys = {};
    advRows().forEach((r) => { const k = r.it[0]; if (!(k in sys) || rank[r.m.hit] < rank[sys[k]]) sys[k] = r.m.hit; });
    const y = Object.keys(sys).filter((k) => sys[k] === 'yes'), c = Object.keys(sys).filter((k) => sys[k] === 'check').length;
    raiseAlert(y.length ? 'urgent' : 'info', `권고문 대조 — 해당 가능 ${y.length}곳 · 확인 필요 ${c}곳`,
      y.length ? `${y.slice(0, 2).join(', ')} 등 소관 시스템이 해당될 수 있습니다. KLID 확인 요청문을 준비했습니다.` : '해당 가능한 시스템이 없습니다.',
      () => $('advResult').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // ── 상황판 ──
  function renderBoard(key) {
    const sc = S[key];
    document.querySelectorAll('#scenarioTabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.s === key)));
    $('asof').textContent = sc.asof; $('tvScenario').textContent = sc.tab;
    $('verdict').className = 'verdict s-' + sc.level;
    $('lamp').textContent = ICON[sc.level];
    $('vTitle').textContent = sc.title;
    $('vText').textContent = sc.text;
    $('systems').innerHTML = sc.sys.map((y) => `<section class="panel s-${y.level}">
      <div class="ptitle"><h3>${esc(y.name)}</h3><span class="pill">${ICON[y.level]} ${LABEL[y.level]}</span></div>
      <div class="who">${esc(y.who)}</div><p class="say">${esc(y.say)}</p>
      <div class="kpis">${y.k.map((k, i) => `<div class="kpi s-${(y.kc || [])[i] || y.level}"><div class="l">${k[0]}</div><div class="v">${k[1]}</div><div class="n">${k[2]}</div></div>`).join('')}</div>
      <div class="spark">${spark(y.curve, y.level)}<div class="cap"><span>오늘 이용자 추이(가상)</span><span>● 현재</span></div></div></section>`).join('');
    $('tiles').innerHTML = sc.tiles.map((t) => `<div class="tile s-${t[1]}"><b>${esc(t[0])}</b><span>${ICON[t[1]]} ${esc(t[2] || TILE_TXT[t[1]])}</span></div>`).join('');
    $('threatPanel').hidden = !sc.threat; if (sc.threat) renderThreat(sc);
    $('regionPanel').hidden = !sc.region; if (sc.region) renderRegion(sc);
    if (sc.incident) { const i = sc.incident; renderGolden($('boardGolden'), { ...i, start: new Date(i.start) }, i.elapsed); }
    else $('boardGolden').hidden = true;
    store.set('gt-scenario', key);
  }

  // ── 장애 접수 ──
  function buildForm() {
    const cats = { critical: '중요 대민서비스', public: '기타 대민서비스', internal: '내부 업무' };
    $('f-services').innerHTML = '<legend>안 되는 서비스</legend>' + Object.entries(cats).map(([c, n]) =>
      `<div class="cat">${n}</div>` + R.services.filter((s) => s.cat === c).map((s) => `<label class="opt"><input type="checkbox" id="svc-${s.id}" value="${s.id}"><span>${esc(s.name)}</span></label>`).join('')).join('');
    $('f-scope').innerHTML = R.scopes.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
    $('f-cause').innerHTML = R.causes.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  }
  const local = (d) => `${E.ymd(d)}T${E.hm(d)}`;
  function readForm() {
    const v = $('f-start').value; if (!v) return null;
    return { start: new Date(v), services: R.services.filter((s) => $('svc-' + s.id).checked).map((s) => s.id),
      scope: $('f-scope').value, cause: $('f-cause').value, full: $('f-full').checked, media: $('f-media').checked };
  }
  let sampleElapsed = null;
  function renderIntake() {
    const input = readForm();
    if (!input || !input.services.length) {
      lastType = null;
      $('result').innerHTML = '<div class="result-empty">왼쪽에서 발생 일시와 안 되는 서비스를 고르세요.</div>';
      $('intakeGolden').hidden = true; return;
    }
    loadHolidays(input.start.getFullYear());
    const since = Math.round((Date.now() - input.start) / 60000);
    const res = renderGolden($('intakeGolden'), input, sampleElapsed ?? (since > 0 && since < 1440 ? since : 0));
    const tone = res.type === 1 ? 'bad' : res.type === 2 ? 'warn' : 'ok';
    $('result').className = 'panel';
    intakeAlert(res);
    $('result').innerHTML = `<div class="ptitle"><h3>판정 결과</h3><span class="pill s-${tone}">${R.types[res.type].name} · ${res.grade}등급</span></div>
      <dl class="kv"><dt>판정 이유</dt><dd>${esc(res.why)}</dd>
        <dt>장애등급</dt><dd>${res.grade}등급${res.gradeNotes.length ? ' (' + esc(res.gradeNotes.join(', ')) + ')' : ' (보정 없음)'}</dd>
        <dt>대응 체계</dt><dd><b>${esc(res.emergency)}</b></dd>
        <dt>보고 라인</dt><dd>${esc(res.report)}</dd>
        <dt>대국민 안내</dt><dd>${res.notice.map(esc).join('<br>')}</dd></dl>
      ${res.extra.map((x) => `<div class="warnbox">${esc(x)}</div>`).join('')}`;
    if (!$('f-recover').value) { $('f-recover').value = local(E.addMin(input.start, 240)); renderDeadline(); }
  }
  function renderDeadline() {
    const v = $('f-recover').value; if (!v) { $('deadlineOut').innerHTML = ''; return; }
    const d = new Date(v); loadHolidays(d.getFullYear());
    const r = E.deadline(d, R, hol(d));
    $('deadlineOut').innerHTML = `<div class="facts-grid" style="margin-top:12px"><div class="fact"><div class="l">기한일에 장애로 전자신고·납부를 못 한 경우</div><div class="v">${r.text}까지</div><small>가산세 등 불이익 없음</small></div></div>
      <ul class="facts">${r.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
      <div class="hint">※ 일정 기간을 정해 일괄 연장할 때는 §26①(지자체장 연장)을 적용합니다(2026.7. 사례: 6.26.~7.6. 도래분 → 7.7.).</div>`;
  }
  function fillSample() {
    const i = S.out.incident;
    $('f-start').value = i.start;
    R.services.forEach((s) => ($('svc-' + s.id).checked = i.services.includes(s.id)));
    $('f-scope').value = i.scope; $('f-cause').value = i.cause; $('f-full').checked = i.full; $('f-media').checked = i.media;
    $('f-recover').value = '2026-11-04T20:50';
    sampleElapsed = i.elapsed; renderIntake(); renderDeadline(); sampleElapsed = null;
  }

  // ── 긴급 경보(재난문자형): 위급=깜빡임+사이렌, 긴급=경고음, 안전안내=띠 알림 ──
  const Alarm = {
    on: false, ctx: null, timer: null,
    async enable() {
      try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); await this.ctx.resume(); } catch (e) {}
      try { if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission(); } catch (e) {}
      this.on = true; this.tone([880], 0.15);
    },
    tone(freqs, dur, gap = 0.05, start = 0) {
      if (!this.ctx) return start;
      let t = this.ctx.currentTime + start;
      for (const f of freqs) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.02); g.gain.setValueAtTime(0.12, t + dur - 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02); t += dur + gap;
      }
      return t - this.ctx.currentTime;
    },
    play(kind) {
      if (!this.on || !this.ctx) return;
      this.stop();
      if (kind === 'beep') { this.tone([1046, 1046, 1046], 0.18, 0.12); return; }
      if (kind === 'siren') {
        const cycle = () => { this.tone([960, 720, 960, 720, 960, 720], 0.42, 0.03); };
        cycle(); let n = 1;
        this.timer = setInterval(() => { if (++n > 4) return this.stop(); cycle(); }, 3600); // 약 15초 후 자동 정지
      }
    },
    stop() { clearInterval(this.timer); this.timer = null; },
  };
  let toastTimer = null;
  function raiseAlert(levelKey, title, text, go) {
    const lv = R.alerts[levelKey]; if (!lv) return;
    const when = new Date();
    try { if (Alarm.on && 'Notification' in window && Notification.permission === 'granted' && levelKey !== 'info') new Notification(`[${lv.name}] ${title}`, { body: text }); } catch (e) {}
    if (levelKey === 'info') {
      const t = $('toast'); t.textContent = `[${lv.name}] ${title}`; t.hidden = false;
      clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 5000); return;
    }
    const ov = $('alertOverlay');
    ov.className = `alert-overlay lv-${levelKey}${lv.flash ? ' flash' : ''}`;
    $('alertLevel').textContent = `${lv.name} 경보`;
    $('alertTitle').textContent = title; $('alertText').textContent = text;
    $('alertMeta').textContent = `${E.fullText(when)} 발령 · ${Alarm.on ? (lv.sound === 'siren' ? '사이렌 울림' : '경고음 울림') : '경보음 꺼짐 — 오른쪽 위에서 켤 수 있습니다'}`;
    ov.hidden = false; $('alertAck').focus();
    $('alertGo').onclick = () => { closeAlert(); if (go) go(); };
    Alarm.play(lv.sound);
  }
  function closeAlert() { $('alertOverlay').hidden = true; Alarm.stop(); }
  $('alertAck').addEventListener('click', closeAlert);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('alertOverlay').hidden) closeAlert(); });
  $('alertToggle').addEventListener('click', async (e) => {
    if (Alarm.on) { Alarm.on = false; Alarm.stop(); } else await Alarm.enable();
    e.currentTarget.setAttribute('aria-pressed', String(Alarm.on));
    e.currentTarget.textContent = Alarm.on ? '경보음 켜짐' : '경보음 켜기';
  });
  function boardAlert(key) {
    const sc = S[key], lv = R.alertMap.board[sc.level]; if (!lv) return;
    const target = sc.incident ? 'boardGolden' : sc.threat ? 'threatPanel' : sc.region ? 'regionPanel' : 'tiles';
    raiseAlert(lv, sc.title, sc.text, () => $(target).scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  let lastType = null;
  function intakeAlert(res) {
    if (!res.type || res.type === lastType) { lastType = res.type; return; }
    lastType = res.type;
    raiseAlert(R.alertMap.type[res.type], `${R.types[res.type].name} · ${res.grade}등급 장애 판정`, res.emergency, () => $('intakeGolden').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  // ── TV 모드: 사무실 벽걸이 TV용 큰 화면(결론·신호등·업무별 상태만), 키보드로 조작 ──
  const tv = { on: false, auto: false, timer: null, clock: null };
  const SC_KEYS = Object.keys(S);
  const tvTick = () => ($('tvClock').textContent = E.fullText(new Date()));
  function tvSet(on) {
    tv.on = on;
    document.documentElement.classList.toggle('tv', on); document.body.classList.toggle('tv', on);
    $('tvToggle').setAttribute('aria-pressed', String(on));
    clearInterval(tv.clock);
    if (on) {
      show('board'); tvTick(); tv.clock = setInterval(tvTick, 1000);
      try { const f = document.documentElement.requestFullscreen; if (f) f.call(document.documentElement).catch(() => {}); } catch (e) {}
    } else {
      tvAuto(false);
      try { if (document.fullscreenElement) document.exitFullscreen(); } catch (e) {}
    }
  }
  function tvGo(key) {
    renderBoard(key); boardAlert(key);
    if (tv.auto) setTimeout(closeAlert, 6000); // 자동 순환 중에는 경보창이 스스로 닫힘
  }
  function tvAuto(on) {
    tv.auto = on; clearInterval(tv.timer);
    $('tvAuto').textContent = on ? 'A 순환 중 · 끄기' : 'A 자동 순환';
    if (on) {
      let i = Math.max(0, SC_KEYS.indexOf(store.get('gt-scenario', 'normal')));
      tv.timer = setInterval(() => { i = (i + 1) % SC_KEYS.length; tvGo(SC_KEYS[i]); }, 9000);
    }
  }
  $('tvToggle').addEventListener('click', () => tvSet(!tv.on));
  $('tvExit').addEventListener('click', () => tvSet(false));
  $('tvAuto').addEventListener('click', () => tvAuto(!tv.auto));
  document.addEventListener('fullscreenchange', () => { if (tv.on && !document.fullscreenElement) tvSet(false); });
  document.addEventListener('keydown', (e) => {
    if (!tv.on || e.ctrlKey || e.metaKey || e.altKey) return;
    const n = +e.key;
    if (n >= 1 && n <= SC_KEYS.length) tvGo(SC_KEYS[n - 1]);
    else if (e.key === 'a' || e.key === 'A') tvAuto(!tv.auto);
    else if (e.key === 't' || e.key === 'T' || (e.key === 'Escape' && $('alertOverlay').hidden)) tvSet(false);
  });

  // ── 화면 전환 ──
  function show(view) {
    ['board', 'intake', 'advisory'].forEach((v) => ($('view-' + v).hidden = v !== view));
    document.querySelectorAll('.nav button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view === 'intake') $('asof').textContent = '장애 상황을 입력하면 매뉴얼 기준으로 판정합니다';
    else if (view === 'advisory') { $('asof').textContent = '보안권고문을 소관 시스템과 자동으로 대조합니다 · 가상 데이터'; renderAdvisory(); }
    else renderBoard(store.get('gt-scenario', 'now') in S ? store.get('gt-scenario', 'now') : 'now');
    store.set('gt-view', view);
  }

  // ── 시작 ──
  $('scenarioTabs').innerHTML = Object.entries(S).map(([k, s]) => `<button id="sc-${k}" data-s="${k}">${esc(s.tab)}</button>`).join('');
  document.querySelectorAll('#scenarioTabs button').forEach((b) => b.addEventListener('click', () => { renderBoard(b.dataset.s); boardAlert(b.dataset.s); }));
  document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
  buildForm();
  $('form').addEventListener('input', renderIntake);
  $('form').addEventListener('change', renderIntake);
  $('f-recover').addEventListener('input', renderDeadline);
  $('f-now').addEventListener('click', () => { $('f-start').value = local(new Date()); renderIntake(); });
  $('f-sample').addEventListener('click', fillSample);
  $('f-reset').addEventListener('click', () => { $('form').reset(); $('f-recover').value = ''; renderIntake(); renderDeadline(); });
  loadHolidays(new Date().getFullYear()); loadHolidays(2026);
  const hash = location.hash.replace('#', '');
  $('adv-run').addEventListener('click', runAdvisory);
  $('adv-reset').addEventListener('click', () => { advState.run = false; renderAdvisory(); });
  const VIEWS = ['board', 'intake', 'advisory'], saved = store.get('gt-view', 'board');
  show(VIEWS.includes(hash) ? hash : VIEWS.includes(saved) ? saved : 'board');
})();
