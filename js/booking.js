/* ============================================================
   부산 5색 웰니스 워크 — 예약 플로우 로직 (booking.html)
   ============================================================ */
(function () {
  const CAPACITY = { A: 20, B: 15 };
  const ALLOWED_DOW = { A: [6], B: [2, 4, 5] }; // 0=Sun ... 6=Sat / 화(2) 목(4) 금(5)
  const RANGE_MONTHS = 12;

  const state = {
    step: 1,
    course: null,        // 'A' | 'B'
    date: null,           // 'YYYY-MM-DD'
    people: 1,
    pet: { name: '', breed: '', size: '', vaccinated: false, sociality: '' },
    foreigner: { nationality: '', guideLanguage: '', hanbokSize: '', dietRestriction: '' },
    applicant: { name: '', phone: '', email: '', consent: false },
    bookingNo: null,
    savedRecordId: null,
  };

  let bookingsCache = null; // 전체 예약 캐시 (정원 계산용)
  let calMonthCursor = null; // 달력에 표시 중인 월 (Date, day=1)

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));

  function pad(n) { return String(n).padStart(2, '0'); }
  function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function startOfDay(d) { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; }

  async function getBookingsCache(force) {
    if (bookingsCache && !force) return bookingsCache;
    bookingsCache = await BW.listBookings();
    return bookingsCache;
  }

  function seatsUsedForDate(course, dateStr, bookings) {
    return bookings
      .filter(b => b.course === course && b.date === dateStr && b.status !== '취소')
      .reduce((sum, b) => sum + (Number(b.people) || 0), 0);
  }

  /* ---------------------- Step indicator ---------------------- */
  function renderStepIndicator() {
    $$('.step-indicator .ind').forEach((el, idx) => {
      const n = idx + 1;
      el.classList.remove('active', 'done');
      if (n < state.step) el.classList.add('done');
      else if (n === state.step) el.classList.add('active');
    });
  }

  function showStep(n) {
    state.step = n;
    $$('.booking-panel').forEach(p => {
      p.style.display = Number(p.dataset.step) === n ? 'block' : 'none';
    });
    renderStepIndicator();
    window.scrollTo({ top: document.querySelector('.booking-wrap').offsetTop - 90, behavior: 'smooth' });
  }

  /* ---------------------- Step 1: 코스 선택 ---------------------- */
  function initStep1() {
    $$('.course-select-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('.course-select-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.course = card.dataset.course;
        $('#step1NextBtn').disabled = false;
      });
    });
    $('#step1NextBtn').addEventListener('click', () => {
      if (!state.course) return;
      // 코스 변경 시 날짜/조건부 필드 초기화
      state.date = null;
      $('#selectedDateBanner').style.display = 'none';
      calMonthCursor = null;
      renderCalendar();
      toggleConditionalFields();
      showStep(2);
    });
  }

  /* ---------------------- Step 2: 날짜 선택 (달력) ---------------------- */
  async function renderCalendar() {
    const wrap = $('#calendarWrap');
    wrap.innerHTML = '<p style="text-align:center; color:#9a9284; padding:30px 0;"><i class="fa-solid fa-spinner fa-spin"></i> 달력을 불러오는 중...</p>';

    const bookings = await getBookingsCache();
    const today = startOfDay(new Date());
    // 현재 월을 포함해 총 12개월의 달력을 탐색할 수 있게 합니다.
    // 예: 2026년 8월이면 2027년 7월까지 표시합니다.
    // 지난 날짜는 기존처럼 예약할 수 없습니다.
    const rangeEnd = new Date(
      today.getFullYear(),
      today.getMonth() + RANGE_MONTHS,
      0
    );

    if (!calMonthCursor) {
      calMonthCursor = new Date(today.getFullYear(), today.getMonth(), 1);
    }

    const y = calMonthCursor.getFullYear();
    const m = calMonthCursor.getMonth();
    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);
    const startWeekday = firstDay.getDay();

    const dowLabels = BW.getLang() === 'en'
      ? ['S', 'M', 'T', 'W', 'T', 'F', 'S']
      : ['일', '월', '화', '수', '목', '금', '토'];

    let html = `<div class="cal-head">
        <button type="button" id="calPrev" aria-label="이전 달"><i class="fa-solid fa-chevron-left"></i></button>
        <h3>${y}. ${pad(m + 1)}</h3>
        <button type="button" id="calNext" aria-label="다음 달"><i class="fa-solid fa-chevron-right"></i></button>
      </div>
      <div class="cal-grid">`;
    dowLabels.forEach(l => html += `<div class="dow">${l}</div>`);

    for (let i = 0; i < startWeekday; i++) html += `<div class="cal-day empty"></div>`;

    const allowedDow = ALLOWED_DOW[state.course] || [];
    const capacity = CAPACITY[state.course] || 0;

    for (let day = 1; day <= lastDay.getDate(); day++) {
      const d = new Date(y, m, day);
      const dStr = toDateStr(d);
      const dow = d.getDay();
      const inRange = d >= today && d <= rangeEnd;
      const isAllowedDow = allowedDow.includes(dow);

      if (!inRange || !isAllowedDow) {
        html += `<div class="cal-day">${day}</div>`;
        continue;
      }

      const used = seatsUsedForDate(state.course, dStr, bookings);
      const remaining = capacity - used;
      const isFull = remaining <= 0;
      const isSelected = state.date === dStr;

      let cls = 'cal-day ';
      cls += isFull ? 'full' : 'available';
      if (isSelected) cls += ' selected';

      const seatLabel = isFull
        ? (BW.getLang() === 'en' ? 'Full' : '마감')
        : (BW.getLang() === 'en' ? `${remaining} left` : `잔여 ${remaining}`);

      html += `<button type="button" class="${cls}" data-date="${dStr}" ${isFull ? 'disabled' : ''}>
          <span>${day}</span><span class="seat">${seatLabel}</span>
        </button>`;
    }

    html += `</div>
      <div class="cal-legend">
        <span><i class="legend-dot avail"></i>${BW.getLang() === 'en' ? 'Available' : '예약 가능'}</span>
        <span><i class="legend-dot full"></i>${BW.getLang() === 'en' ? 'Full' : '마감'}</span>
        <span><i class="legend-dot sel"></i>${BW.getLang() === 'en' ? 'Selected' : '선택됨'}</span>
      </div>`;

    wrap.innerHTML = html;

    $('#calPrev').addEventListener('click', () => {
      const prevMonth = new Date(y, m - 1, 1);
      if (prevMonth.getFullYear() === today.getFullYear() && prevMonth.getMonth() < today.getMonth()) return;
      calMonthCursor = prevMonth;
      renderCalendar();
    });
    $('#calNext').addEventListener('click', () => {
      const nextMonth = new Date(y, m + 1, 1);
      if (nextMonth > rangeEnd) return;
      calMonthCursor = nextMonth;
      renderCalendar();
    });

    $$('.cal-day.available').forEach(btn => {
      btn.addEventListener('click', () => {
        state.date = btn.dataset.date;
        $$('.cal-day').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        const banner = $('#selectedDateBanner');
        banner.style.display = 'flex';
        banner.querySelector('span').textContent = formatDateHuman(state.date);
        $('#step2NextBtn').disabled = false;
      });
    });
  }

  function formatDateHuman(dStr) {
    const [y, m, d] = dStr.split('-').map(Number);
    const dow = new Date(y, m - 1, d).getDay();
    const dowLabelsKo = ['일', '월', '화', '수', '목', '금', '토'];
    const dowLabelsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (BW.getLang() === 'en') {
      return `${y}-${pad(m)}-${pad(d)} (${dowLabelsEn[dow]})`;
    }
    return `${y}년 ${m}월 ${d}일 (${dowLabelsKo[dow]})`;
  }

  function initStep2() {
    $('#step2BackBtn').addEventListener('click', () => showStep(1));
    $('#step2NextBtn').addEventListener('click', () => {
      if (!state.date) return;
      showStep(3);
    });
  }

  /* ---------------------- Step 3: 인원 + 조건부 필드 ---------------------- */
  function toggleConditionalFields() {
    $('#petFields').style.display = state.course === 'A' ? 'block' : 'none';
    $('#foreignerFields').style.display = state.course === 'B' ? 'block' : 'none';
    $('#peopleHint').textContent = state.course === 'A'
      ? (BW.getLang() === 'en' ? '(Guardian + dog counted as 1 unit)' : '(보호자+반려견 1팀 기준)')
      : '';
  }

  function initStep3() {
    $('#peopleInput').addEventListener('input', (e) => {
      state.people = Math.max(1, Math.min(4, Number(e.target.value) || 1));
    });
    $('#step3BackBtn').addEventListener('click', () => showStep(2));
    $('#step3NextBtn').addEventListener('click', () => {
      // 유효성 검사
      let ok = true;
      if (state.course === 'A') {
        state.pet.name = $('#petName').value.trim();
        state.pet.breed = $('#petBreed').value.trim();
        state.pet.size = $('input[name="petSize"]:checked')?.value || '';
        state.pet.vaccinated = $('#petVaccinated').checked;
        state.pet.sociality = $('input[name="petSociality"]:checked')?.value || '';

        toggleFieldError('#petName', !state.pet.name);
        toggleFieldError('#petSizeGroup', !state.pet.size);
        toggleFieldError('#petVaccinatedGroup', !state.pet.vaccinated);
        toggleFieldError('#petSocialityGroup', !state.pet.sociality);
        if (!state.pet.name || !state.pet.size || !state.pet.vaccinated || !state.pet.sociality) ok = false;
      } else if (state.course === 'B') {
        state.foreigner.nationality = $('#nationality').value.trim();
        state.foreigner.guideLanguage = $('input[name="guideLanguage"]:checked')?.value || '';
        state.foreigner.hanbokSize = $('input[name="hanbokSize"]:checked')?.value || '';
        state.foreigner.dietRestriction = $('input[name="dietRestriction"]:checked')?.value || '없음';

        toggleFieldError('#nationality', !state.foreigner.nationality);
        toggleFieldError('#hanbokSizeGroup', !state.foreigner.hanbokSize);
        if (!state.foreigner.nationality || !state.foreigner.hanbokSize) ok = false;
      }
      if (!ok) return;
      showStep(4);
    });
  }

  function toggleFieldError(sel, hasError) {
    const el = $(sel);
    if (!el) return;
    const group = el.closest('.form-group') || el;
    group.classList.toggle('error', hasError);
  }

  /* ---------------------- Step 4: 신청자 정보 ---------------------- */
  function initStep4() {
    $('#step4BackBtn').addEventListener('click', () => showStep(3));
    $('#step4SubmitBtn').addEventListener('click', onSubmitFinal);
  }

  async function onSubmitFinal() {
    const name = $('#applicantName').value.trim();
    const phone = $('#applicantPhone').value.trim();
    const email = $('#applicantEmail').value.trim();
    const consent = $('#applicantConsent').checked;

    toggleFieldError('#applicantName', !name);
    toggleFieldError('#applicantPhone', !phone);
    toggleFieldError('#applicantEmail', !email);
    toggleFieldError('#consentGroup', !consent);

    if (!name || !phone || !email || !consent) return;

    state.applicant = { name, phone, email, consent };

    const btn = $('#step4SubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (BW.getLang() === 'en' ? 'Submitting...' : '처리 중...');

    try {
      // 최종 정원 재검증
      const bookings = await getBookingsCache(true);
      const used = seatsUsedForDate(state.course, state.date, bookings);
      const capacity = CAPACITY[state.course];
      if (used + state.people > capacity) {
        alert(BW.getLang() === 'en'
          ? 'Sorry, this date just became full. Please choose another date.'
          : '죄송합니다. 방금 정원이 마감되었습니다. 다른 날짜를 선택해 주세요.');
        btn.disabled = false;
        btn.innerHTML = BW.getLang() === 'en' ? 'Confirm Booking' : '예약 신청하기';
        showStep(2);
        renderCalendar();
        return;
      }

      const bookingNo = await BW.generateBookingNo();
      const payload = {
        bookingNo,
        course: state.course,
        date: state.date,
        people: state.people,
        name, phone, email,
        consent: true,
        status: '확정',
      };
      if (state.course === 'A') {
        payload.petName = state.pet.name;
        payload.petBreed = state.pet.breed;
        payload.petSize = state.pet.size;
        payload.petVaccinated = state.pet.vaccinated;
        payload.petSociality = state.pet.sociality;
      } else {
        payload.nationality = state.foreigner.nationality;
        payload.guideLanguage = state.foreigner.guideLanguage;
        payload.hanbokSize = state.foreigner.hanbokSize;
        payload.dietRestriction = state.foreigner.dietRestriction;
      }

      const created = await BW.createBooking(payload);
      state.bookingNo = bookingNo;
      state.savedRecordId = created.id;
      renderSummary();
      showStep(5);
    } catch (err) {
      console.error(err);
      alert(BW.getLang() === 'en' ? 'Something went wrong. Please try again.' : '예약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      btn.disabled = false;
      btn.innerHTML = BW.getLang() === 'en' ? 'Confirm Booking' : '예약 신청하기';
    }
  }

  /* ---------------------- Step 5: 완료 요약 ---------------------- */
  function renderSummary() {
    const isEn = BW.getLang() === 'en';
    $('#summaryBookingNo').textContent = state.bookingNo;
    const courseName = state.course === 'A'
      ? (isEn ? 'Course A · Doggie Sensory School' : '코스 A · 댕댕오감학교')
      : (isEn ? 'Course B · K-Wellness Busan Walk' : '코스 B · K-웰니스 부산워크');

    const rows = [
      [isEn ? 'Course' : '코스', courseName],
      [isEn ? 'Date' : '날짜', formatDateHuman(state.date)],
      [isEn ? 'Participants' : '인원', `${state.people}${isEn ? '' : '명'}`],
    ];
    if (state.course === 'A') {
      rows.push([isEn ? 'Dog Name' : '반려견 이름', state.pet.name]);
      rows.push([isEn ? 'Breed' : '견종', state.pet.breed || '-']);
      rows.push([isEn ? 'Size' : '크기', state.pet.size]);
    } else {
      rows.push([isEn ? 'Nationality' : '국적', state.foreigner.nationality]);
      rows.push([isEn ? 'Hanbok Size' : '한복 사이즈', state.foreigner.hanbokSize]);
    }
    rows.push([isEn ? 'Applicant' : '신청자', state.applicant.name]);
    rows.push([isEn ? 'Contact' : '연락처', state.applicant.phone]);

    $('#summaryTable').innerHTML = rows.map(([lbl, val]) =>
      `<div class="summary-row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`
    ).join('');
  }

  /* ---------------------- 언어 변경 시 갱신 ---------------------- */
  window.onLangChange = function () {
    if (state.step === 2) renderCalendar();
    toggleConditionalFields();
    if (state.step === 5 && state.bookingNo) renderSummary();
    if (state.date) {
      const banner = $('#selectedDateBanner');
      if (banner && banner.style.display !== 'none') {
        banner.querySelector('span').textContent = formatDateHuman(state.date);
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initStep1();
    initStep2();
    initStep3();
    initStep4();
    showStep(1);

    // URL 쿼리로 코스 사전 선택 (course-a/b 상세페이지에서 유입 시)
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('course');
    if (preset === 'A' || preset === 'B') {
      const card = $(`.course-select-card[data-course="${preset}"]`);
      if (card) card.click();
    }
  });
})();
