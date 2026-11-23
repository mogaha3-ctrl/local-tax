/*
 * 캐릭터 「골키퍼」(골든타임 키퍼) — 지방세시스템의 골든타임을 지키는 수문장
 * - 직접 그린 원본 캐릭터(SVG). 화면·슬라이드·영상에서 같은 그림을 씁니다.
 * - 상황판 7개 화면과 1:1: normal·warn·bad·threat·breach·region·drill (+ hero 대표 이미지)
 * - 영상용 개별 파일: node tools/export-mascot.js → assets/mascot/*.svg
 * - 설정집(말투·대사·영상 활용): docs/mascot.md
 */
(function () {
  const GOLD = '#F7C531', GOLDD = '#c98c00', NAVY = '#1f3a6b', GLOVE = '#8fd14f', GLOVED = '#4f8f1f', INK = '#1f2a44';

  const net = () => {
    let s = '<g opacity=".35" stroke="#9aa6b8" stroke-width="2" fill="none"><path d="M30 200 V60 H210 V200"/>';
    for (let x = 50; x < 210; x += 20) s += `<line x1="${x}" y1="60" x2="${x}" y2="200"/>`;
    for (let y = 80; y < 200; y += 20) s += `<line x1="30" y1="${y}" x2="210" y2="${y}"/>`;
    return s + '</g>';
  };
  const mitt = (x, y, r = 22, ang = 0) =>
    `<g transform="rotate(${ang} ${x} ${y})"><rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r + 6}" rx="${r * 0.8}" fill="${GLOVE}" stroke="${GLOVED}" stroke-width="4"/>` +
    `<rect x="${x - r + 4}" y="${y + r - 4}" width="${2 * r - 8}" height="10" rx="3" fill="#fff" stroke="${GLOVED}" stroke-width="3"/>` +
    `<line x1="${x - 6}" y1="${y - r + 6}" x2="${x - 6}" y2="${y}" stroke="${GLOVED}" stroke-width="3"/><line x1="${x + 6}" y1="${y - r + 6}" x2="${x + 6}" y2="${y}" stroke="${GLOVED}" stroke-width="3"/></g>`;
  const eyes = ({ dx = 0, dy = 0, r = 9, brow = null, squint = false } = {}) => {
    let s = '';
    for (const cx of [96, 144]) {
      s += squint
        ? `<path d="M${cx - 10} 112 Q${cx} 104 ${cx + 10} 112" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`
        : `<circle cx="${cx + dx}" cy="${110 + dy}" r="${r}" fill="${INK}"/><circle cx="${cx + dx + 3}" cy="${106 + dy}" r="3" fill="#fff"/>`;
    }
    if (brow === 'angry') s += `<path d="M84 94 L106 100 M156 94 L134 100" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    if (brow === 'worry') s += `<path d="M84 98 L106 92 M156 98 L134 92" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    return s;
  };
  const blush = '<ellipse cx="80" cy="132" rx="11" ry="6" fill="#f39a7a" opacity=".7"/><ellipse cx="160" cy="132" rx="11" ry="6" fill="#f39a7a" opacity=".7"/>';
  const smile = `<path d="M106 134 Q120 148 134 134" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  const flat = `<path d="M108 138 H132" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const wavy = `<path d="M104 140 q6 -6 12 0 q6 6 12 0 q6 -6 8 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  const shout = `<ellipse cx="120" cy="140" rx="13" ry="11" fill="${INK}"/><ellipse cx="120" cy="145" rx="7" ry="4" fill="#e66"/>`;
  const sweat = '<path d="M178 82 q8 12 0 18 q-8 -6 0 -18z" fill="#7cc4ff" stroke="#3b8fd6" stroke-width="2"/>';
  const sweat2 = '<path d="M62 92 q6 9 0 14 q-6 -5 0 -14z" fill="#7cc4ff" stroke="#3b8fd6" stroke-width="2"/>';

  // 몸통: 금빛 공 + 유니폼(등번호) + 배의 골든타임 시계
  const body = (face, mitts, { front = '', rot = 0, jersey = NAVY, num = '1' } = {}) => {
    const big = num.length === 1;
    return `<g transform="rotate(${rot} 120 140)"><ellipse cx="120" cy="222" rx="62" ry="8" fill="#0002"/>` +
      `<circle cx="120" cy="135" r="72" fill="${GOLD}"/>` +
      `<path d="M50.04 152 H189.96 A72 72 0 0 1 50.04 152 Z" fill="${jersey}"/>` +
      `<circle cx="120" cy="135" r="72" fill="none" stroke="${GOLDD}" stroke-width="5"/>` +
      `<text x="${big ? 120 : 106}" y="196" font-size="${big ? 30 : 20}" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">${num}</text>` +
      `<circle cx="150" cy="172" r="9" fill="#fff"/><line x1="150" y1="172" x2="150" y2="166" stroke="${INK}" stroke-width="2"/><line x1="150" y1="172" x2="154" y2="174" stroke="${INK}" stroke-width="2"/>` +
      face + mitts + front + '</g>';
  };
  const virus = (x, y) => {
    let s = '<g>';
    for (let a = 0; a < 360; a += 45) {
      const ax = (x + 26 * Math.cos(a * Math.PI / 180)).toFixed(1), ay = (y + 26 * Math.sin(a * Math.PI / 180)).toFixed(1);
      s += `<line x1="${x}" y1="${y}" x2="${ax}" y2="${ay}" stroke="#b91c1c" stroke-width="4"/><circle cx="${ax}" cy="${ay}" r="4" fill="#b91c1c"/>`;
    }
    return s + `<circle cx="${x}" cy="${y}" r="18" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/><text x="${x}" y="${y + 5}" font-size="12" font-weight="800" fill="#fff" text-anchor="middle" font-family="sans-serif">PHP</text></g>`;
  };
  const lock = `<g><path d="M106 182 v-14 a14 14 0 0 1 28 0 v14" stroke="${INK}" stroke-width="6" fill="none"/><rect x="98" y="180" width="44" height="34" rx="6" fill="#facc15" stroke="${INK}" stroke-width="4"/><circle cx="120" cy="195" r="5" fill="${INK}"/></g>`;
  const pin = '<g><path d="M200 40 a22 22 0 0 1 22 22 c0 18 -22 38 -22 38 s-22 -20 -22 -38 a22 22 0 0 1 22 -22z" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/><circle cx="200" cy="62" r="8" fill="#fff"/></g><text x="34" y="60" font-size="40" font-weight="800" fill="#6b7280" font-family="sans-serif">?</text>';
  const whistle = `<g><rect x="126" y="134" width="30" height="16" rx="6" fill="#d1d5db" stroke="${INK}" stroke-width="3"/><circle cx="158" cy="142" r="10" fill="#d1d5db" stroke="${INK}" stroke-width="3"/></g>`;
  const cone = '<g><path d="M200 218 L214 160 L228 218Z" fill="#fb923c" stroke="#c2410c" stroke-width="3"/><rect x="194" y="214" width="40" height="8" rx="2" fill="#c2410c"/><rect x="207" y="186" width="14" height="6" fill="#fff"/></g>';
  const alarm = '<path d="M30 70 l-16 -10 M26 96 h-20 M210 70 l16 -10 M214 96 h20" stroke="#ef4444" stroke-width="6" stroke-linecap="round"/>';
  const spark = '<path d="M172 30 l-8 -10 M190 20 l-2 -14 M226 30 l8 -10" stroke="#F2B61F" stroke-width="5" stroke-linecap="round"/>';

  const ART = {
    hero: () => net() + body(eyes() + blush + smile, mitt(46, 150, 24, -20) + mitt(194, 150, 24, 20)),
    normal: () => body(eyes() + blush + smile, mitt(52, 160, 20, -10) + mitt(196, 96, 20, 15)),
    warn: () => body(eyes({ brow: 'worry' }) + blush + wavy + sweat, mitt(70, 178, 20, 0) + mitt(170, 178, 20, 0)),
    bad: () => body(eyes({ r: 11, brow: 'worry' }) + shout, mitt(48, 72, 22, -25) + mitt(192, 72, 22, 25)) + alarm,
    threat: () => net() + body(eyes({ dx: 6, brow: 'angry' }) + flat, mitt(205, 92, 24, 30) + mitt(70, 170, 20, -20), { rot: -14 }) + virus(204, 52) + spark,
    breach: () => body(eyes({ squint: true, brow: 'angry' }) + flat + sweat + sweat2, mitt(84, 196, 18, 0) + mitt(156, 196, 18, 0), { front: lock }),
    region: () => body(eyes({ dx: 8, dy: -4 }) + blush + flat, mitt(56, 160, 20, -10) + mitt(186, 120, 20, 25)) + pin,
    drill: () => body(eyes() + blush + whistle, mitt(52, 160, 20, -10) + mitt(160, 186, 18, 0), { jersey: '#7c3aed', num: '훈련' }) + cone,
  };

  window.MASCOT = {
    name: '골키퍼',
    full: '골든타임 키퍼',
    motto: '골든타임, 제가 막습니다!',
    // 상황별 대사(화면 말풍선·영상 내레이션 공통)
    states: {
      hero: { label: '대표', shape: '', line: '골든타임, 제가 막습니다!', pose: '양손 장갑 · 골대 앞' },
      normal: { label: '평상시', shape: '●', line: '오늘도 무실점! 이상 없어요.', pose: '엄지 척 · 여유' },
      warn: { label: '처리 지연 주의', shape: '▲', line: '공이 느려졌어요… 지켜보는 중!', pose: '식은땀 · 준비 자세' },
      bad: { label: '장애 상황', shape: '■', line: '비상! 골든타임 시작! 할 일을 순서대로 알려드릴게요.', pose: '두 팔 번쩍 · 경보' },
      threat: { label: '외부 위협(해킹)', shape: '◆', line: '해킹 슛, 선방합니다! 서버는 끄지 말고 외부 접속만 막아요.', pose: '다이빙 세이브' },
      breach: { label: '계정 공격 의심', shape: '◆', line: '수상한 로그인, 문 잠가요!', pose: '실눈 · 식은땀 · 자물쇠' },
      region: { label: '지역 접속 불량', shape: '▲', line: '어느 지역이 안 되는지 먼저 볼게요.', pose: '두리번 · 위치 핀' },
      drill: { label: '모의훈련', shape: '◇', line: '실전처럼 훈련 중! 실제 상황 아니에요.', pose: '호루라기 · 훈련 조끼' },
    },
    // 상황판 시나리오 키 → 캐릭터 상태
    byScenario: { normal: 'normal', now: 'warn', threat: 'threat', breach: 'breach', region: 'region', drill: 'drill', out: 'bad' },
    byLevel: { ok: 'normal', warn: 'warn', bad: 'bad', threat: 'threat', drill: 'drill' },
    svg(state, size = 120, title) {
      const art = (ART[state] || ART.hero)();
      const t = title || `${this.name} — ${(this.states[state] || this.states.hero).label}`;
      return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 240 240" role="img" aria-label="${t}"><title>${t}</title>${art}</svg>`;
    },
  };
})();

