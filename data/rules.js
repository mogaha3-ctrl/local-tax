/*
 * 판정 규칙표 — 「지방세정보시스템 장애발생 시 비상대응 매뉴얼」(2026.10.) 기준
 * ─────────────────────────────────────────────
 * 이 파일만 바꾸면 다른 정보시스템에도 그대로 쓸 수 있습니다(범용 키트).
 * 코드를 몰라도 '이름', '분류', '시간' 값만 고치면 됩니다.
 * ※ 'TODO 확인' 표시는 매뉴얼에 명시되지 않아 담당 부서 확인이 필요한 값입니다.
 */
window.RULES = {
  system: {
    name: '표준지방세정보시스템 및 위택스',
    url: 'www.wetax.go.kr',
    owner: '행정안전부 지방세입정보과',
    serverLocation: '한국지역정보개발원(KLID)',
    baseGrade: 1, // A1(국가 핵심) 시스템 → 1등급 원칙
  },

  // 업무시간: 매뉴얼에 정의가 없어 내부업무 등급보정 기준(평일 09~18시)을 준용 — TODO 확인
  businessHours: { start: 9, end: 18 },
  // 등급 보정 기준(정보시스템 안정성 고시): 대국민 09~21시, 내부 09~18시 이외 1개 등급 하향
  gradeHours: { public: { start: 9, end: 21 }, internal: { start: 9, end: 18 } },

  // 서비스 목록과 분류
  //  critical = 중요 대민서비스(유형1 대상), public = 기타 대민서비스(유형2), internal = 내부 업무(유형3)
  services: [
    { id: 'acq',     name: '취득세·등록면허세 신고', cat: 'critical' },
    { id: 'pay',     name: '지방세 납부',            cat: 'critical' },
    { id: 'cert',    name: '제증명 발급',            cat: 'critical' },
    { id: 'seize',   name: '압류 해제',              cat: 'critical' },
    { id: 'nts',     name: '국세 연계(지방소득세 신고)', cat: 'public' },
    { id: 'seoul',   name: '서울시 과세증명 통합발급',  cat: 'public' },
    { id: 'family',  name: '가족관계·등기부 연계',     cat: 'public' },
    { id: 'refund',  name: '환급',                   cat: 'public' },
    { id: 'ledger',  name: '재산세 대장정비·통계',     cat: 'internal' },
    { id: 'claim',   name: '경정청구·세무대리인 대행승인', cat: 'internal' },
  ],

  scopes: [
    { id: 'national', name: '전국(서울 제외)', gradeDown: 0 },
    { id: 'single',   name: '단일 광역 또는 기초 지자체', gradeDown: 1 },
    { id: 'partial',  name: '단일 지자체의 일부 지역', gradeDown: 2 },
  ],

  causes: [
    { id: 'unknown',  name: '확인 중' },
    { id: 'internal', name: '내부요인(HW·SW·과부하)' },
    { id: 'infra',    name: '기반시설(전원·항온항습 등)' },
    { id: 'cyber',    name: '사이버침해(DDoS·해킹·랜섬웨어)' },
    { id: 'link',     name: '외부 연계기관 장애' },
  ],

  types: {
    1: { name: '유형1', desc: '업무시간 내 중요 대민서비스 장애', emergency: '세제국 비상대응체계 즉시 가동',
         report: '국장 → 실장 → 차관실 → 장관실 (필요시 대통령실)' },
    2: { name: '유형2', desc: '업무시간 내 영향이 상대적으로 낮은 대민서비스 장애', emergency: '지방세입정보과 초동 대응',
         report: '국장 → 실장 → 차관실 → 장관실 (필요시 대통령실)' },
    3: { name: '유형3', desc: '업무시간 외 장애 또는 내부 업무 장애', emergency: '지방세입정보과 차원 대응',
         report: '실 내부보고(국장·실장)' },
  },

  // 유형2 → 비상대응체계 전환 기준
  type2Escalation: { hours: 4, endOfDay: 18 },

  // 골든타임 타임라인. at = 경과 분(minutes) 또는 clock = 시각(시). when = 적용 조건
  timeline: [
    { at: 0,   label: '즉시', when: 't12', task: '유형 판정 · 국장~장관실 최초보고(텔레그램) · KLID 장애 공유방 가동 · 지방세정책과·재정정책과 공유' },
    { at: 0,   label: '즉시', when: 'full', task: '위택스 Sorry page 게시(서비스 이용 제한 안내)' },
    { at: 0,   label: '즉시', when: 'partial', task: '위택스 공지사항·서비스별 팝업 안내' },
    { at: 0,   label: '즉시', when: 't3', task: '위택스 공지 · KLID 장애 공유방 가동 · 지방정부 상황 안내 · 실 내부보고' },
    { at: 0,   label: '즉시', when: 'cyber', task: '디지털보안정책과 즉시 공유 · 침해사고 신고(KISA 118·보호나라) · 해킹 의심 시 서버는 끄지 말고 외부 접속만 차단(흔적 보존)' },
    { at: 10,  label: '10분', when: 't12', task: '장애 성립(10분 이상) — 디지털안전상황실 총괄관리 개시, 상황 확인 요청 대응' },
    { at: 30,  label: '30분', when: 'full', task: '전체 장애 30분 지속 — 1시간 이내 기자단 문자 전파(대변인실 협의)' },
    { at: 30,  label: '30분', when: 't1', task: '정부24·금융결제원 등 연계기관 납부 불가 안내 공문' },
    { at: 60,  label: '1시간', when: 't1', task: '지자체에 세목별 대응 매뉴얼 공문 · 신고·납부기한 연장 검토' },
    { at: 120, label: '2시간', when: 'g1', task: '1등급 장애 2시간 경과 — 중간보고(서면), 디지털안전상황실 2시간 간격 상황 확인 대응' },
    { at: 240, label: '4시간', when: 't2', task: '유형2 장기화 — 세제국 비상대응체계 가동, KLID 현장상황실 운영' },
    { at: 240, label: '4시간', when: 't1', task: '복구 지연 — 현장상황실 상주, 언론 동향 수시보고, 보도자료(기한연장) 검토' },
    { clock: 17, label: '18시 임박', when: 't2', task: '업무 종료 임박 — 4시간 전이라도 비상대응체계 가동 검토' },
    { clock: 17, label: '18시 임박', when: 't1', task: '업무 종료 임박 — 익일 처리 안내, 기한 추가 연장 여부 결정' },
    { at: 720, label: '12시간', when: 'g1', task: '위기경보 ‘주의’ 검토 — 디지털보안정책과 총괄, 지방세입정보과장 참여' },
    { at: 'nextBiz', label: '다음 평일 09시', when: 'afterHoursCritical', task: '미복구 시 원래 장애등급 부여 → 유형1로 재판정' },
  ],

  // 긴급 경보 — 재난문자 3단계를 본뜬 알림 강도
  //  critical(위급): 화면 깜빡임 + 상승 알림음 + 알림 / urgent(긴급): 띵동 알림음 + 알림창 / info(안전안내): 소리 없이 띠 알림
  //  거슬리는 사이렌 대신 맑은 종소리 신호음(현장 의견 반영). 음원 파일 없이 브라우저가 합성합니다
  alerts: {
    critical: { name: '위급', sound: 'rise',     soundLabel: '상승 알림음(띵띵띵띵)', flash: true },
    urgent:   { name: '긴급', sound: 'dingdong', soundLabel: '띵동 알림음', flash: false },
    info:     { name: '안전안내', sound: null, flash: false },
  },
  // 선율: [음이름, 길이(초)], 'r' = 쉼표. timbre: bell(종) / strings(현악)
  //  위급은 올라가며 빠르게 반복, 긴급은 내려오며 천천히 두 번 — 방향이 반대라 듣자마자 구분됩니다
  melodies: {
    rise:     { timbre: 'bell', vol: 0.22, repeat: 3, gap: 0.7, // 도-미-솔-도↑ 두 번
                notes: [['C5', 0.11], ['E5', 0.11], ['G5', 0.11], ['C6', 0.3], ['r', 0.12], ['C5', 0.11], ['E5', 0.11], ['G5', 0.11], ['C6', 0.6]] },
    dingdong: { timbre: 'bell', vol: 0.2, repeat: 1, gap: 0, // 라→파 "띵-동, 띵-동"
                notes: [['A5', 0.3], ['F5', 0.6], ['r', 0.25], ['A5', 0.3], ['F5', 1.0]] },
    hello:    { timbre: 'bell', vol: 0.14, repeat: 1, gap: 0, notes: [['G5', 0.28], ['E5', 0.7]] }, // 경보음 켤 때 확인음
  },
  // 판정 유형·상황판 상태 → 경보 단계
  alertMap: { type: { 1: 'critical', 2: 'urgent', 3: 'info' }, board: { bad: 'critical', threat: 'urgent', warn: 'info' } },

  // 기한 특례(지방세기본법 §24)
  deadline: {
    article: '지방세기본법 제24조',
    laborDay: { month: 5, day: 1 }, // §24① 근로자의 날
  },

  // 일부 지자체 접속 불량 — 원인 분리 기준(제안 기준, 확정 전 TODO 확인)
  region: {
    escalateCount: 5, // 서로 다른 지자체 N곳 이상 동시 신고 시 장애 접수(유형 판정)로 격상 검토
    questions: [
      { id: 'central', q: '중앙 서버 지표는 정상인가요?', hint: '1초 처리량·느린 요청 비율(상황판 위쪽 두 카드)' },
      { id: 'others', q: '같은 지자체에서 세외수입 등 다른 시스템도 느린가요?', hint: '지자체 담당자에게 한 번만 물어보면 됩니다' },
      { id: 'sameArea', q: '신고한 지자체가 한 권역(같은 광역망·통신 구간)에 몰려 있나요?', hint: '접수 목록의 지역을 보세요' },
    ],
    causes: {
      central: { name: '중앙 시스템 문제 가능', who: 'KLID·세제국', ask: '중앙 서버 상태 현장 확인(KLID)', action: '장애 접수 화면에서 유형을 판정하고 골든타임을 시작하세요. 중앙 지표 이상이 확인된 상태입니다.' },
      area:    { name: '권역 통신망 문제 의심', who: '광역 네트워크 담당·통신사', ask: '해당 권역 광역망·통신 구간 점검', action: '중앙 서버는 정상이고 여러 지자체의 다른 시스템도 느립니다. 해당 권역 광역망·통신 구간 점검을 요청하세요.' },
      local:   { name: '해당 지자체 네트워크 문제 의심', who: '지자체 전산 담당', ask: '청사 네트워크(회선·방화벽·프록시) 점검', action: '중앙 서버는 정상이고 해당 지자체의 다른 시스템도 느립니다. 지자체 청사 네트워크(회선·방화벽) 점검을 요청하세요.' },
      client:  { name: '단말·프로그램 설치 문제 의심', who: '지자체 담당·KLID', ask: '단말 브라우저·프로그램 설치·캐시 점검 및 접속 기록 확인', action: '다른 시스템은 정상입니다. 단말 브라우저·프로그램 설치·캐시를 점검하고, KLID에 해당 접속 기록을 확인 요청하세요.' },
    },
  },
};
