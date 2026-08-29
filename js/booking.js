/* ============================================================
   OSAEK.W — DB/API 연결 예약 플로우
   ============================================================ */
(function () {
  const RANGE_MONTHS = 12;

  const state = {
    step: 1,
    course: null,
    courseOption: '',
    date: null,
    people: 1,
    pet: { name:'', breed:'', size:'', vaccinated:false, sociality:'' },
    foreigner: { nationality:'', guideLanguage:'', hanbokSize:'', dietRestriction:'' },
    applicant: { name:'', phone:'', email:'', consent:false },
    bookingNo: null,
    savedRecordId: null,
  };

  let calMonthCursor = null;

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const pad = n => String(n).padStart(2, '0');
  const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  function startOfDay(d){ const c=new Date(d); c.setHours(0,0,0,0); return c; }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type':'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `HTTP_${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function renderStepIndicator() {
    $$('.step-indicator .ind').forEach((el, idx) => {
      const n = idx + 1;
      el.classList.remove('active','done');
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
    const wrap = document.querySelector('.booking-wrap');
    if (wrap) window.scrollTo({ top: wrap.offsetTop - 90, behavior:'smooth' });
  }

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
      state.date = null;
      $('#selectedDateBanner').style.display = 'none';
      calMonthCursor = null;
      renderCalendar();
      toggleConditionalFields();
      showStep(2);
    });
  }

  async function renderCalendar() {
    const wrap = $('#calendarWrap');
    wrap.innerHTML = '<p style="text-align:center;color:#9a9284;padding:30px 0;"><i class="fa-solid fa-spinner fa-spin"></i> 달력을 불러오는 중...</p>';

    const today = startOfDay(new Date());
    const rangeEnd = new Date(today.getFullYear(), today.getMonth() + RANGE_MONTHS, 0);
    if (!calMonthCursor) calMonthCursor = new Date(today.getFullYear(), today.getMonth(), 1);

    const y = calMonthCursor.getFullYear();
    const m = calMonthCursor.getMonth();
    const firstDay = new Date(y,m,1);
    const lastDay = new Date(y,m+1,0);
    const startWeekday = firstDay.getDay();
    const monthFrom = toDateStr(firstDay);
    const monthTo = toDateStr(lastDay);

    let availability;
    try {
      availability = await api(`/api/availability?course=${encodeURIComponent(state.course)}&from=${monthFrom}&to=${monthTo}`);
    } catch (err) {
      console.error(err);
      wrap.innerHTML = '<div style="padding:28px;text-align:center;color:#b35f50;">달력 데이터를 불러오지 못했습니다.<br>잠시 후 다시 시도해 주세요.</div>';
      return;
    }

    const allowedDow = (availability.allowedDow || []).map(Number);
    const capacity = Number(availability.capacity || 0);
    const usedByDate = availability.used || {};

    const dowLabels = BW.getLang() === 'en'
      ? ['S','M','T','W','T','F','S']
      : ['일','월','화','수','목','금','토'];

    let html = `<div class="cal-head">
      <button type="button" id="calPrev" aria-label="이전 달"><i class="fa-solid fa-chevron-left"></i></button>
      <h3>${y}. ${pad(m+1)}</h3>
      <button type="button" id="calNext" aria-label="다음 달"><i class="fa-solid fa-chevron-right"></i></button>
    </div><div class="cal-grid">`;

    dowLabels.forEach(l => html += `<div class="dow">${l}</div>`);
    for (let i=0;i<startWeekday;i++) html += '<div class="cal-day empty"></div>';

    for (let day=1; day<=lastDay.getDate(); day++) {
      const d = new Date(y,m,day);
      const dStr = toDateStr(d);
      const inRange = d >= today && d <= rangeEnd;
      const isAllowed = allowedDow.includes(d.getDay());

      if (!inRange || !isAllowed) {
        html += `<div class="cal-day">${day}</div>`;
        continue;
      }

      const remaining = capacity - (Number(usedByDate[dStr]) || 0);
      const isFull = remaining <= 0;
      const isSelected = state.date === dStr;
      let cls = `cal-day ${isFull ? 'full' : 'available'}`;
      if (isSelected) cls += ' selected';

      const seatLabel = isFull
        ? (BW.getLang()==='en' ? 'Full' : '마감')
        : (BW.getLang()==='en' ? `${remaining} left` : `잔여 ${remaining}`);

      html += `<button type="button" class="${cls}" data-date="${dStr}" ${isFull?'disabled':''}>
        <span>${day}</span><span class="seat">${seatLabel}</span>
      </button>`;
    }

    html += `</div><div class="cal-legend">
      <span><i class="legend-dot avail"></i>${BW.getLang()==='en'?'Available':'예약 가능'}</span>
      <span><i class="legend-dot full"></i>${BW.getLang()==='en'?'Full':'마감'}</span>
      <span><i class="legend-dot sel"></i>${BW.getLang()==='en'?'Selected':'선택됨'}</span>
    </div>`;

    wrap.innerHTML = html;

    $('#calPrev').addEventListener('click', () => {
      const prev = new Date(y,m-1,1);
      const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      if (prev < currentMonth) return;
      calMonthCursor = prev;
      renderCalendar();
    });

    $('#calNext').addEventListener('click', () => {
      const next = new Date(y,m+1,1);
      const lastAllowedMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
      if (next > lastAllowedMonth) return;
      calMonthCursor = next;
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
    const [y,m,d] = dStr.split('-').map(Number);
    const dow = new Date(y,m-1,d).getDay();
    const ko = ['일','월','화','수','목','금','토'];
    const en = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return BW.getLang()==='en'
      ? `${y}-${pad(m)}-${pad(d)} (${en[dow]})`
      : `${y}년 ${m}월 ${d}일 (${ko[dow]})`;
  }

  function initStep2() {
    $('#step2BackBtn').addEventListener('click', () => showStep(1));
    $('#step2NextBtn').addEventListener('click', () => { if (state.date) showStep(3); });
  }

  function toggleConditionalFields() {
    $('#petFields').style.display = state.course === 'A' ? 'block' : 'none';
    $('#foreignerFields').style.display = state.course === 'B' ? 'block' : 'none';
    $('#peopleHint').textContent = state.course === 'A'
      ? (BW.getLang()==='en' ? '(Guardian + dog counted as 1 unit)' : '(보호자+반려견 1팀 기준)')
      : '';
  }

  function toggleFieldError(sel, hasError) {
    const el = $(sel);
    if (!el) return;
    const group = el.closest('.form-group') || el;
    group.classList.toggle('error', hasError);
  }

  function initStep3() {
    $('#peopleInput').addEventListener('input', e => {
      state.people = Math.max(1, Math.min(4, Number(e.target.value) || 1));
    });
    $('#step3BackBtn').addEventListener('click', () => showStep(2));
    $('#step3NextBtn').addEventListener('click', () => {
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

      if (ok) showStep(4);
    });
  }

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

    state.applicant = { name,phone,email,consent };
    const btn = $('#step4SubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (BW.getLang()==='en'?'Submitting...':'처리 중...');

    const payload = {
      course: state.course,
      courseOption: state.courseOption,
      date: state.date,
      people: state.people,
      name, phone, email, consent:true,
    };
    if (state.course === 'A') {
      Object.assign(payload, {
        petName: state.pet.name,
        petBreed: state.pet.breed,
        petSize: state.pet.size,
        petVaccinated: state.pet.vaccinated,
        petSociality: state.pet.sociality,
      });
    } else {
      Object.assign(payload, {
        nationality: state.foreigner.nationality,
        guideLanguage: state.foreigner.guideLanguage,
        hanbokSize: state.foreigner.hanbokSize,
        dietRestriction: state.foreigner.dietRestriction,
      });
    }

    try {
      const result = await api('/api/bookings', {
        method:'POST',
        body: JSON.stringify(payload),
      });
      const b = result.booking;
      state.bookingNo = b.booking_no;
      state.savedRecordId = b.id;
      renderSummary();
      showStep(5);
    } catch (err) {
      console.error(err);
      if (err.message === 'CAPACITY_FULL') {
        alert(BW.getLang()==='en'
          ? 'This date is full. Please choose another date.'
          : '선택하신 날짜의 정원이 마감되었습니다. 다른 날짜를 선택해 주세요.');
        showStep(2);
        renderCalendar();
      } else if (err.message === 'DATE_NOT_ALLOWED') {
        alert('관리자가 예약 가능 요일을 변경했습니다. 날짜를 다시 선택해 주세요.');
        showStep(2);
        renderCalendar();
      } else {
        alert(BW.getLang()==='en'
          ? 'Something went wrong. Please try again.'
          : '예약 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
      }
      btn.disabled = false;
      btn.textContent = BW.getLang()==='en' ? 'Confirm Booking' : '예약 신청하기';
    }
  }

  function renderSummary() {
    const isEn = BW.getLang()==='en';
    $('#summaryBookingNo').textContent = state.bookingNo;
    const courseName = state.course === 'A'
      ? (isEn ? 'Course A · Doggie Sensory School' : '코스 A · 댕댕오감학교')
      : (isEn ? 'Course B · K-Wellness Busan Walk' : '코스 B · K-웰니스 부산워크');

    const rows = [
      [isEn?'Course':'코스', courseName],
      [isEn?'Date':'날짜', formatDateHuman(state.date)],
      [isEn?'Participants':'인원', `${state.people}${isEn?'':'명'}`],
    ];
    if (state.course === 'A') {
      rows.push([isEn?'Dog Name':'반려견 이름', state.pet.name]);
      rows.push([isEn?'Breed':'견종', state.pet.breed || '-']);
      rows.push([isEn?'Size':'크기', state.pet.size]);
    } else {
      rows.push([isEn?'Nationality':'국적', state.foreigner.nationality]);
      rows.push([isEn?'Hanbok Size':'한복 사이즈', state.foreigner.hanbokSize]);
    }
    rows.push([isEn?'Applicant':'신청자', state.applicant.name]);
    rows.push([isEn?'Contact':'연락처', state.applicant.phone]);

    $('#summaryTable').innerHTML = rows.map(([lbl,val]) =>
      `<div class="summary-row"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`
    ).join('');
  }

  window.onLangChange = function(){
    if (state.step===2) renderCalendar();
    toggleConditionalFields();
    if (state.step===5 && state.bookingNo) renderSummary();
    if (state.date) {
      const banner = $('#selectedDateBanner');
      if (banner && banner.style.display !== 'none') {
        banner.querySelector('span').textContent = formatDateHuman(state.date);
      }
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initStep1(); initStep2(); initStep3(); initStep4(); showStep(1);
    const params = new URLSearchParams(location.search);
    const preset = params.get('course');
    const option = params.get('option');
    if (option) state.courseOption = option;
    if (preset === 'A' || preset === 'B') {
      const card = $(`.course-select-card[data-course="${preset}"]`);
      if (card) card.click();
    }
  });
})();
