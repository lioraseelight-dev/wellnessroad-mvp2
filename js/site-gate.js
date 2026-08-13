/* ============================================================
   부산 5색 웰니스 워크 — 사이트 전체 접근 게이트 (시범 비공개 모드)
   ------------------------------------------------------------
   ⚠️ 안내: 이 파일은 정적 사이트용 "소프트 게이트"입니다.
   즉, 접속 코드를 모르는 일반 방문자를 안내 페이지(coming-soon.html)로
   돌려보내는 용도이며, 브라우저 소스코드를 직접 열어보는 사람까지
   막을 수 있는 완전한 보안 장치는 아닙니다. (서버가 없는 정적
   사이트의 구조적 한계입니다.) 심사/시범 공유 단계에서 "링크를 아는
   사람만 들어오게" 하는 용도로 사용하세요.

   ▷ 전체 공개로 전환하려면 아래 SITE_LOCKED 값을 false로 바꾸면 됩니다.
   ▷ 접속 코드를 바꾸려면 ACCESS_CODE 값을 수정하세요.
   ============================================================ */
(function () {
  const SITE_LOCKED = true;              // true = 제한 공개(코드 필요) / false = 전체 공개
  const ACCESS_CODE = 'bw-preview-2026'; // 공유용 접속 코드 (원하시면 언제든 변경 요청하세요)
  const STORAGE_KEY = 'bw_site_access_ok';
  const GATE_PAGE = 'coming-soon.html';

  if (!SITE_LOCKED) return;

  const path = window.location.pathname;
  if (path.endsWith(GATE_PAGE)) return; // 안내 페이지 자체는 게이트 대상 아님

  const params = new URLSearchParams(window.location.search);
  const keyParam = params.get('key');

  // ?key=코드 형태의 특수 링크로 접속 → 자동 인증
  if (keyParam && keyParam === ACCESS_CODE) {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    params.delete('key');
    const cleanQuery = params.toString();
    const newUrl = window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + window.location.hash;
    window.history.replaceState({}, '', newUrl);
    return;
  }

  // 이미 인증된 브라우저(localStorage에 플래그 있음)
  try {
    if (localStorage.getItem(STORAGE_KEY) === '1') return;
  } catch (e) {}

  // 인증되지 않음 → 준비 중 안내 페이지로 이동 (원래 가려던 경로 저장)
  try {
    sessionStorage.setItem('bw_redirect_after_gate', path.split('/').pop() + window.location.search);
  } catch (e) {}
  window.location.replace(GATE_PAGE);
})();
