/*
 * 보안권고문 대조 — 시연용 가상 자산 대장과 권고문 요약
 * - 자산 대장·버전은 모두 가상 예시입니다(실제 소관 시스템 정보 아님).
 * - PHP 영향 버전은 과기정통부·KISA 「PHP2Shell 보안 취약점 FAQ」의 안전 버전과 일치함을 확인했습니다.
 * - Java 영향 버전은 공문 사진에서 읽은 값이라 원문 확인이 필요합니다(TODO 확인).
 * - 실제 도입 시 INVENTORY는 자산 대장 연동으로, ADVISORIES는 권고문 메일 수신으로 대체합니다.
 */
window.ADVISORIES = [
  { id: 'php-urgent', product: 'php', title: 'PHP 원격 코드 실행 취약점(긴급)', src: '행정안전부 긴급 보안조치 요청', date: '10.22.', mode: 'fixed',
    lines: [{ line: '8.2', fixed: '8.2.35', sunset: '12.31. 지원 종료 예정 — 8.3 이상 권장' }, { line: '8.3', fixed: '8.3.36' }, { line: '8.4', fixed: '8.4.27' }, { line: '8.5', fixed: '8.5.12' }],
    note: '8.1 이하는 패치가 없어 8.3 이상으로 전환, 8.2는 12.31. 지원 종료' },
  { id: 'php-temp', product: 'php', title: 'PHP 신규 취약점 — 임시 조치 권고', src: 'KISA 보안권고', date: '10.24.', mode: 'temp',
    note: '10.24. 공지(신규 1건) — 보안 업데이트로 패치, 그 전까지 추가 보안 설정' },
  { id: 'java', product: 'java', title: 'Oracle Java 인증서 신뢰 취약점', src: 'KISA 보안권고', date: '10.23.', mode: 'upTo',
    lines: [{ line: '8', upTo: '8u511' }, { line: '11', upTo: '11.0.33' }, { line: '17', upTo: '17.0.21' }, { line: '21', upTo: '21.0.13' }, { line: '25', upTo: '25.0.5' }, { line: '27', upTo: '27.0.1' }],
    note: 'Oracle 보안 패치 적용' },
  { id: 'laravel', product: 'laravel', title: 'Laravel 보안 업데이트', src: 'KISA 보안권고', date: '10.23.', mode: 'noDetail',
    note: '첨부 본문에서 영향 버전 확인 필요' },
  { id: 'node', product: 'node', title: 'Node.js 보안 업데이트', src: 'KISA 보안권고', date: '10.23.', mode: 'noDetail',
    note: '첨부 본문에서 영향 버전 확인 필요' },
];

window.SW_NAME = { php: 'PHP', java: 'Java', laravel: 'Laravel', node: 'Node.js' };

// [시스템, 구분, 소프트웨어, 버전(빈 값 = 미확인)] — 가상 예시
window.INVENTORY = [
  ['위택스 웹·WAS', '국민용', 'java', '17.0.19'],
  ['스마트위택스 API', '국민용', 'java', '21.0.14'],
  ['세무행정 WAS', '공무원용', 'java', '8u401'],
  ['세무대리인 대행 서비스', '외부 접속', 'php', '8.1.30'],
  ['지자체 세정 안내 페이지', '외부 접속', 'php', ''],
  ['지방세 통계·조회 포털', '공무원용', 'php', '8.3.30'],
  ['지방세 통계·조회 포털(프레임워크)', '공무원용', 'laravel', '10.48'],
  ['민간앱 환급 연계 서버', '외부 접속', 'node', '20.11'],
];
