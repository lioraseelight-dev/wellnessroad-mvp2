/* ============================================================
   OSAEK.W 홈 히어로 배경영상 적용
   - 기존 이미지 배경은 비디오 로딩 실패 시 fallback으로 유지
   - 자동재생 / 음소거 / 반복 / 모바일 인라인 재생
   ============================================================ */
(function () {
  const VIDEO_URL = 'https://wellnessroad-mvp2.vercel.app/main2026_01.mp4';

  function applyHomeHeroVideo() {
    // 홈 화면이 아니면 실행하지 않음
    const body = document.body;
    if (!body) return;

    // 현재 홈의 대표 문구를 기준으로 정확한 히어로 영역을 찾습니다.
    const heading = Array.from(document.querySelectorAll('h1'))
      .find(el => (el.textContent || '').includes('부산의 바다를 걷다'));

    // 문구 탐색 실패 시 첫 번째 .hero를 fallback으로 사용
    const hero = heading
      ? heading.closest('section')
      : document.querySelector('main .hero, .hero');

    if (!hero) {
      console.warn('[home-video] 홈 히어로 영역을 찾지 못했습니다.');
      return;
    }

    if (hero.querySelector('.home-hero-video')) return;

    // 기존 배경 이미지는 fallback용으로 그대로 둡니다.
    hero.style.position = 'relative';
    hero.style.overflow = 'hidden';
    hero.style.isolation = 'isolate';

    const video = document.createElement('video');
    video.className = 'home-hero-video';
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-hidden', 'true');
    video.setAttribute('tabindex', '-1');

    Object.assign(video.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      objectPosition: 'center',
      zIndex: '-3',
      pointerEvents: 'none'
    });

    const source = document.createElement('source');
    source.src = VIDEO_URL;
    source.type = 'video/mp4';
    video.appendChild(source);

    // 영상 위에 기존 이미지와 비슷한 어두운 오버레이를 유지
    const overlay = document.createElement('div');
    overlay.className = 'home-hero-video-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      background: 'linear-gradient(90deg, rgba(20,15,12,.68) 0%, rgba(20,15,12,.42) 55%, rgba(20,15,12,.34) 100%)',
      zIndex: '-2',
      pointerEvents: 'none'
    });

    // 기존 텍스트/버튼은 영상 앞으로
    Array.from(hero.children).forEach(child => {
      if (child === video || child === overlay) return;
      if (getComputedStyle(child).position === 'static') {
        child.style.position = 'relative';
      }
      child.style.zIndex = '1';
    });

    hero.prepend(overlay);
    hero.prepend(video);

    // 브라우저 정책 때문에 첫 autoplay 시도가 실패할 경우 다시 시도
    const tryPlay = () => {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    };

    video.addEventListener('canplay', tryPlay, { once: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && video.paused) tryPlay();
    });

    // 사용자가 '동작 줄이기'를 선호하는 경우 영상 대신 기존 이미지 유지
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      video.remove();
      overlay.remove();
      return;
    }

    tryPlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHomeHeroVideo);
  } else {
    applyHomeHeroVideo();
  }
})();
