/* ============================================================
   OSAEK.W 홈 히어로 최종 영상 배경
   - 기존 배경 이미지 제거
   - 기존 중복 video 제거
   - main2026_01.mp4를 히어로 전체 배경으로 사용
   - 기존 제목/설명/버튼은 영상 위에 표시
   ============================================================ */
(function () {
  const VIDEO_URL = '/main2026_01.mp4';

  function findHero() {
    const title = Array.from(document.querySelectorAll('h1'))
      .find(el => (el.textContent || '').includes('부산의 바다를 걷다'));

    if (title) return title.closest('section');
    return document.querySelector('main .hero, section.hero, .hero');
  }

  function initHeroVideo() {
    const hero = findHero();
    if (!hero) {
      console.warn('[hero-video] 메인 히어로 영역을 찾지 못했습니다.');
      return;
    }

    /* 1. 기존 배경 이미지 완전히 제거 */
    hero.style.background = '#111';
    hero.style.backgroundImage = 'none';
    hero.style.backgroundColor = '#111';
    hero.style.position = 'relative';
    hero.style.overflow = 'hidden';
    hero.style.isolation = 'isolate';

    /*
      2. 이전 작업에서 삽입된 video / overlay가 있다면 모두 제거.
         이렇게 해야 왼쪽에 세로 영상이 한 장 더 겹쳐 보이지 않습니다.
    */
    hero.querySelectorAll(
      ':scope > video, :scope > .home-hero-video, :scope > .hero-bg-video, :scope > .home-hero-video-overlay, :scope > .hero-video-overlay'
    ).forEach(el => el.remove());

    /*
      히어로 바로 아래에 수동으로 추가된 이미지가 있으면 제거합니다.
      container 내부의 콘텐츠 이미지는 건드리지 않습니다.
    */
    hero.querySelectorAll(':scope > img, :scope > picture').forEach(el => el.remove());

    /* 3. 화면 전체를 채우는 배경 video 생성 */
    const video = document.createElement('video');
    video.className = 'hero-bg-video';
    video.autoplay = true;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('loop', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('aria-hidden', 'true');

    Object.assign(video.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      minWidth: '100%',
      minHeight: '100%',
      objectFit: 'cover',
      objectPosition: 'center center',
      zIndex: '0',
      display: 'block',
      pointerEvents: 'none'
    });

    const source = document.createElement('source');
    source.src = VIDEO_URL;
    source.type = 'video/mp4';
    video.appendChild(source);

    /* 4. 영상 위 가독성용 어두운 음영 */
    const overlay = document.createElement('div');
    overlay.className = 'hero-video-overlay';

    Object.assign(overlay.style, {
      position: 'absolute',
      inset: '0',
      zIndex: '1',
      pointerEvents: 'none',
      background:
        'linear-gradient(90deg, rgba(14,14,14,.64) 0%, rgba(14,14,14,.39) 58%, rgba(14,14,14,.30) 100%)'
    });

    /* 5. 기존 콘텐츠를 영상과 음영보다 위로 */
    Array.from(hero.children).forEach(child => {
      if (
        child.classList &&
        (child.classList.contains('hero-bg-video') ||
         child.classList.contains('hero-video-overlay'))
      ) return;

      child.style.position = 'relative';
      child.style.zIndex = '2';
    });

    hero.prepend(overlay);
    hero.prepend(video);

    /* prepend 후에도 콘텐츠 계층을 확실히 보장 */
    Array.from(hero.children).forEach(child => {
      if (child === video) return;
      if (child === overlay) return;
      child.style.position = 'relative';
      child.style.zIndex = '2';
    });

    /* 자동재생 재시도 */
    const play = () => {
      const result = video.play();
      if (result && result.catch) result.catch(() => {});
    };

    video.addEventListener('loadeddata', play, { once: true });
    video.addEventListener('canplay', play, { once: true });
    play();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroVideo);
  } else {
    initHeroVideo();
  }
})();
