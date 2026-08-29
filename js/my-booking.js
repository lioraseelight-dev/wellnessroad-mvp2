/* ============================================================
   OSAEK.W 예약 조회 — 휴대폰 번호 11자리 조회
   예약번호 입력 없이, 예약 시 입력한 휴대폰 번호로 조회합니다.
   ============================================================ */
(function () {
  let lastResults = [];
  let lastPhone = '';

  function t(key, fallback) {
    const dict = window.PAGE_DICT || {};
    const lang = window.BW && BW.getLang ? BW.getLang() : 'ko';
    return (dict[lang] && dict[lang][key]) ||
           (dict.ko && dict.ko[key]) ||
           fallback ||
           key;
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
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

  function digitsOnly(value) {
    return String(value || '').replace(/[^0-9]/g, '').slice(0, 11);
  }

  function maskPhone(value) {
    const p = digitsOnly(value);
    if (p.length !== 11) return value || '-';
    return `${p.slice(0, 3)}-****-${p.slice(7)}`;
  }

  function courseName(course) {
    return course === 'A'
      ? t('course_a_name', '코스 A · 댕댕오감학교')
      : t('course_b_name', '코스 B · K-웰니스 부산워크');
  }

  function statusLabel(status) {
    const isEn = window.BW && BW.getLang && BW.getLang() === 'en';
    if (status === '취소') return isEn ? 'Cancelled' : '취소';
    return isEn ? 'Confirmed' : '확정';
  }

  function bookingCard(booking, index) {
    const isEn = window.BW && BW.getLang && BW.getLang() === 'en';
    const cancelled = booking.status === '취소';
    const extraRows = booking.course === 'A'
      ? `
        <div class="summary-row">
          <span class="lbl">${isEn ? 'Dog Name' : '반려견 이름'}</span>
          <span class="val">${booking.petName || '-'}</span>
        </div>
        <div class="summary-row">
          <span class="lbl">${isEn ? 'Size' : '크기'}</span>
          <span class="val">${booking.petSize || '-'}</span>
        </div>`
      : `
        <div class="summary-row">
          <span class="lbl">${isEn ? 'Nationality' : '국적'}</span>
          <span class="val">${booking.nationality || '-'}</span>
        </div>
        <div class="summary-row">
          <span class="lbl">${isEn ? 'Hanbok Size' : '한복 사이즈'}</span>
          <span class="val">${booking.hanbokSize || '-'}</span>
        </div>`;

    return `
      <div class="booking-result-card course-${booking.course}" style="${index > 0 ? 'margin-top:18px;' : ''}">
        <div class="top-row">
          <div>
            <div style="font-weight:800; font-size:17px;">${booking.bookingNo || '-'}</div>
            <div style="color:#8a8375; font-size:13.5px; margin-top:2px;">
              ${courseName(booking.course)}
            </div>
          </div>
          <span class="status-badge ${cancelled ? 'cancelled' : 'confirmed'}">
            ${statusLabel(booking.status)}
          </span>
        </div>

        <div class="summary-card">
          <div class="summary-row">
            <span class="lbl">${isEn ? 'Date' : '날짜'}</span>
            <span class="val">${booking.date || '-'}</span>
          </div>
          <div class="summary-row">
            <span class="lbl">${isEn ? 'Participants' : '인원'}</span>
            <span class="val">${booking.people ?? '-'}</span>
          </div>
          ${extraRows}
          <div class="summary-row">
            <span class="lbl">${isEn ? 'Applicant' : '신청자'}</span>
            <span class="val">${booking.name || '-'}</span>
          </div>
          <div class="summary-row">
            <span class="lbl">${isEn ? 'Phone' : '연락처'}</span>
            <span class="val">${maskPhone(booking.phone)}</span>
          </div>
        </div>

        ${!cancelled ? `
          <button
            type="button"
            class="btn btn-outline btn-block cancel-booking-btn"
            data-booking-no="${booking.bookingNo || ''}"
            style="margin-top:16px;">
            ${isEn ? 'Cancel Booking' : '예약 취소'}
          </button>` : ''}
      </div>
    `;
  }

  function renderResults(bookings) {
    lastResults = Array.isArray(bookings) ? bookings : [];
    const area = document.getElementById('resultArea');
    if (!area) return;

    const isEn = window.BW && BW.getLang && BW.getLang() === 'en';

    area.innerHTML = `
      ${lastResults.length > 1
        ? `<div style="margin:18px 0 10px; font-weight:700; color:#478d89;">
             ${isEn
               ? `${lastResults.length} bookings found for this phone number.`
               : `이 휴대폰 번호로 ${lastResults.length}건의 예약을 찾았습니다.`}
           </div>`
        : ''}
      ${lastResults.map(bookingCard).join('')}
    `;

    area.querySelectorAll('.cancel-booking-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const bookingNo = btn.dataset.bookingNo;
        if (!bookingNo) return;

        const confirmText = isEn
          ? 'Cancel this booking?'
          : '이 예약을 취소하시겠습니까?';
        if (!confirm(confirmText)) return;

        btn.disabled = true;

        try {
          await api('/api/cancel', {
            method: 'POST',
            body: JSON.stringify({
              bookingNo,
              phone: lastPhone
            })
          });

          const target = lastResults.find(b => b.bookingNo === bookingNo);
          if (target) target.status = '취소';
          renderResults(lastResults);

          alert(isEn ? 'Booking cancelled.' : '예약이 취소되었습니다.');
        } catch (err) {
          console.error(err);
          alert(isEn ? 'Cancellation failed.' : '예약 취소 중 오류가 발생했습니다.');
          btn.disabled = false;
        }
      });
    });
  }

  function updateLookupUI() {
    const isEn = window.BW && BW.getLang && BW.getLang() === 'en';

    // 기존 예약번호 입력칸이 남아 있는 버전도 자동으로 제거합니다.
    const bookingNoInput = document.getElementById('lookupBookingNo');
    if (bookingNoInput) {
      const group = bookingNoInput.closest('.form-group') || bookingNoInput.parentElement;
      if (group) group.remove();
    }

    // 기존 "연락처 뒤 4자리" 입력칸을 11자리 휴대폰 번호 입력칸으로 재사용합니다.
    const phoneInput =
      document.getElementById('lookupPhone4') ||
      document.getElementById('lookupPhone');

    if (phoneInput) {
      phoneInput.id = 'lookupPhone';
      phoneInput.type = 'tel';
      phoneInput.inputMode = 'numeric';
      phoneInput.maxLength = 11;
      phoneInput.placeholder = '01012345678';
      phoneInput.autocomplete = 'tel';

      phoneInput.addEventListener('input', () => {
        phoneInput.value = digitsOnly(phoneInput.value);
      });

      const oldLabel =
        document.querySelector('label[for="lookupPhone4"]') ||
        document.querySelector('label[for="lookupPhone"]');

      if (oldLabel) {
        oldLabel.setAttribute('for', 'lookupPhone');
        oldLabel.textContent = isEn ? 'Mobile phone number' : '휴대폰 번호 11자리';
      }
    }

    // 페이지 안내 문구를 현재 조회방식에 맞게 바꿉니다.
    const allTextElements = Array.from(
      document.querySelectorAll('p, .panel-desc, [data-i18n], label')
    );
    allTextElements.forEach(el => {
      const txt = (el.textContent || '').trim();
      if (
        txt.includes('예약번호와 연락처 뒤 4자리') ||
        txt.includes('예약번호와 연락처') ||
        txt.includes('예약번호로 확인')
      ) {
        el.textContent = isEn
          ? 'Enter the 11-digit mobile phone number used for your booking.'
          : '예약 시 입력한 휴대폰 번호 11자리를 입력해 예약 내역을 확인하세요.';
      }
      if (txt === '연락처 뒤 4자리') {
        el.textContent = isEn ? 'Mobile phone number' : '휴대폰 번호 11자리';
      }
    });
  }

  async function handleLookup(e) {
    e.preventDefault();

    const phoneInput =
      document.getElementById('lookupPhone') ||
      document.getElementById('lookupPhone4');

    const phone = digitsOnly(phoneInput ? phoneInput.value : '');
    const errEl = document.getElementById('lookupError');
    const resultArea = document.getElementById('resultArea');

    if (errEl) errEl.style.display = 'none';
    if (resultArea) resultArea.innerHTML = '';

    if (phone.length !== 11) {
      if (errEl) {
        errEl.textContent = '휴대폰 번호 11자리를 정확히 입력해 주세요.';
        errEl.style.display = 'block';
      } else {
        alert('휴대폰 번호 11자리를 정확히 입력해 주세요.');
      }
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    }

    try {
      lastPhone = phone;

      const result = await api('/api/lookup', {
        method: 'POST',
        body: JSON.stringify({ phone })
      });

      renderResults(result.bookings || []);
    } catch (err) {
      console.error(err);

      if (errEl) {
        errEl.textContent = err.message === 'NOT_FOUND'
          ? '해당 휴대폰 번호로 예약된 내역을 찾을 수 없습니다.'
          : '예약 조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
        errEl.style.display = 'block';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText || '조회하기';
      }
    }
  }

  window.onLangChange = function () {
    updateLookupUI();
    if (lastResults.length) renderResults(lastResults);
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateLookupUI();

    const form = document.getElementById('lookupForm');
    if (form) {
      form.addEventListener('submit', handleLookup);
    }
  });
})();
