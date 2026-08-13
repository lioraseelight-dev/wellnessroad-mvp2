/* ============================================================
   부산 5색 웰니스 워크 — 공통 스크립트
   (언어 토글, 헤더/탭바 활성화, A2HS 배너, 공용 유틸)
   ============================================================ */

const BW = (function () {
  const LANG_KEY = 'bw_lang';

  /* ---------------- 공통 번역 사전 (헤더/탭바/푸터) ---------------- */
  const COMMON_DICT = {
    ko: {
      nav_home: '홈',
      nav_courses: '코스 소개',
      nav_booking: '예약하기',
      nav_my: '예약 조회',
      nav_admin: '관리자',
      tab_home: '홈',
      tab_courses: '코스',
      tab_booking: '예약',
      tab_my: '내 예약',
      header_cta: '지금 예약하기',
      a2hs_title: '홈 화면에 추가하기',
      a2hs_body: '앱처럼 빠르게 이용하려면 홈 화면에 추가하세요. iOS는 공유 버튼 → "홈 화면에 추가"를 눌러주세요.',
      footer_org: '모두의 창업 1기 시범 운영 서비스',
      footer_contact: '문의 이메일: (추후 기입)',
      footer_copy: '© 2026 부산 5색 웰니스 워크',
    },
    en: {
      nav_home: 'Home',
      nav_courses: 'Courses',
      nav_booking: 'Book Now',
      nav_my: 'My Booking',
      nav_admin: 'Admin',
      tab_home: 'Home',
      tab_courses: 'Courses',
      tab_booking: 'Book',
      tab_my: 'My Booking',
      header_cta: 'Book Now',
      a2hs_title: 'Add to Home Screen',
      a2hs_body: 'Add this app to your home screen for quick access. On iOS, tap Share → "Add to Home Screen".',
      footer_org: 'A Pilot Service by Modu-ui Changup Batch 1',
      footer_contact: 'Contact: (to be announced)',
      footer_copy: '© 2026 Busan 5-Color Wellness Walk',
    }
  };

  function getLang() {
    return localStorage.getItem(LANG_KEY) || 'ko';
  }

  function setLang(lang) {
    localStorage.setItem(LANG_KEY, lang);
    applyLang();
  }

  function t(dict, key) {
    const lang = getLang();
    return (dict[lang] && dict[lang][key]) || (dict.ko && dict.ko[key]) || '';
  }

  // 페이지별 사전을 window.PAGE_DICT 로 등록해두면 함께 적용됨
  function applyLang() {
    const lang = getLang();
    document.documentElement.lang = lang;
    document.body.classList.toggle('lang-en', lang === 'en');

    const dicts = [COMMON_DICT];
    if (window.PAGE_DICT) dicts.push(window.PAGE_DICT);

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      let val = null;
      for (const d of dicts) {
        if (d[lang] && d[lang][key] !== undefined) { val = d[lang][key]; break; }
      }
      if (val !== null) {
        if (el.hasAttribute('data-i18n-html')) el.innerHTML = val;
        else el.textContent = val;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      let val = null;
      for (const d of dicts) {
        if (d[lang] && d[lang][key] !== undefined) { val = d[lang][key]; break; }
      }
      if (val !== null) el.setAttribute('placeholder', val);
    });

    // 언어 토글 버튼 표시 갱신
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    if (typeof window.onLangChange === 'function') window.onLangChange(lang);
  }

  function initLangToggle() {
    document.querySelectorAll('.lang-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    applyLang();
  }

  /* ---------------- 현재 페이지에 맞춰 nav / tabbar 활성화 ---------------- */
  function highlightNav() {
    const page = document.body.dataset.page;
    document.querySelectorAll('.gnb-links a, .bottom-tabbar a').forEach((a) => {
      a.classList.toggle('active', a.dataset.nav === page);
    });
  }

  /* ---------------- A2HS 배너 ---------------- */
  function initA2HS() {
    const banner = document.getElementById('a2hsBanner');
    if (!banner) return;
    const dismissed = localStorage.getItem('bw_a2hs_dismissed');
    const isMobile = window.innerWidth <= 768;
    if (!dismissed && isMobile) {
      setTimeout(() => banner.classList.add('show'), 1200);
    }
    const closeBtn = banner.querySelector('.a2hs-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        banner.classList.remove('show');
        localStorage.setItem('bw_a2hs_dismissed', '1');
      });
    }
  }

  /* ---------------- Table API 헬퍼 (bookings 테이블) ---------------- */
  const TABLE = 'bookings';

  async function listBookings() {
    let all = [];
    let page = 1;
    const limit = 100;
    while (true) {
      const res = await fetch(`tables/${TABLE}?page=${page}&limit=${limit}`);
      if (!res.ok) break;
      const json = await res.json();
      all = all.concat(json.data || []);
      if (!json.data || json.data.length < limit) break;
      page++;
      if (page > 50) break;
    }
    return all;
  }

  async function createBooking(payload) {
    const res = await fetch(`tables/${TABLE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('예약 저장 실패');
    return await res.json();
  }

  async function patchBooking(id, payload) {
    const res = await fetch(`tables/${TABLE}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('예약 수정 실패');
    return await res.json();
  }

  /* ---------------- 예약번호 생성 ---------------- */
  function formatBookingDate(d) {
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }

  async function generateBookingNo() {
    const today = new Date();
    const datePart = formatBookingDate(today);
    const all = await listBookings();
    const prefix = `BW-${datePart}-`;
    const countToday = all.filter(b => (b.bookingNo || '').startsWith(prefix)).length;
    const seq = String(countToday + 1).padStart(3, '0');
    return `${prefix}${seq}`;
  }

  /* ---------------- 초기화 ---------------- */
  function init() {
    initLangToggle();
    highlightNav();
    initA2HS();
    // PWA 서비스워커 등록 없이도 manifest만으로 A2HS 가능
  }

  document.addEventListener('DOMContentLoaded', init);

  return {
    getLang, setLang, t, applyLang,
    listBookings, createBooking, patchBooking, generateBookingNo,
    COMMON_DICT
  };
})();
