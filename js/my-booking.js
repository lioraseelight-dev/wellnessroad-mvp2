/* OSAEK.W 예약 조회 — DB/API 연결 */
(function () {
  let lastResult = null;
  let lastLookup = null;

  function t(key) {
    const dict = window.PAGE_DICT || {};
    const lang = BW.getLang();
    return (dict[lang] && dict[lang][key]) || (dict.ko && dict.ko[key]) || key;
  }

  async function api(url, options={}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type':'application/json', ...(options.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
    return data;
  }

  function courseName(course) {
    return course === 'A' ? t('course_a_name') : t('course_b_name');
  }

  function renderResult(booking) {
    lastResult = booking;
    const isEn = BW.getLang() === 'en';
    const statusClass = booking.status === '취소' ? 'cancelled' : 'confirmed';
    const statusLabel = booking.status === '취소' ? t('result_status_cancelled') : t('result_status_confirmed');

    const extraRows = booking.course === 'A'
      ? `<div class="summary-row"><span class="lbl">${isEn?'Dog Name':'반려견 이름'}</span><span class="val">${booking.petName || '-'}</span></div>
         <div class="summary-row"><span class="lbl">${isEn?'Size':'크기'}</span><span class="val">${booking.petSize || '-'}</span></div>`
      : `<div class="summary-row"><span class="lbl">${isEn?'Nationality':'국적'}</span><span class="val">${booking.nationality || '-'}</span></div>
         <div class="summary-row"><span class="lbl">${isEn?'Hanbok Size':'한복 사이즈'}</span><span class="val">${booking.hanbokSize || '-'}</span></div>`;

    document.getElementById('resultArea').innerHTML = `
      <div class="booking-result-card course-${booking.course}">
        <div class="top-row">
          <div>
            <div style="font-weight:800;font-size:17px;">${booking.bookingNo}</div>
            <div style="color:#8a8375;font-size:13.5px;margin-top:2px;">${courseName(booking.course)}</div>
          </div>
          <span class="status-badge ${statusClass}">${statusLabel}</span>
        </div>
        <div class="summary-card">
          <div class="summary-row"><span class="lbl">${t('result_date')}</span><span class="val">${booking.date}</span></div>
          <div class="summary-row"><span class="lbl">${t('result_people')}</span><span class="val">${booking.people}</span></div>
          ${extraRows}
          <div class="summary-row"><span class="lbl">${t('result_applicant')}</span><span class="val">${booking.name}</span></div>
          <div class="summary-row"><span class="lbl">${t('result_phone')}</span><span class="val">${booking.phone}</span></div>
        </div>
        ${booking.status !== '취소'
          ? `<button type="button" class="btn btn-outline btn-block" id="cancelBookingBtn" style="margin-top:16px;">${t('btn_cancel')}</button>`
          : ''}
      </div>`;

    const cancelBtn = document.getElementById('cancelBookingBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (!confirm(t('cancel_confirm'))) return;
        cancelBtn.disabled = true;
        try {
          await api('/api/cancel', {
            method:'POST',
            body: JSON.stringify(lastLookup)
          });
          booking.status = '취소';
          renderResult(booking);
          alert(t('cancel_done'));
        } catch (e) {
          console.error(e);
          alert('오류가 발생했습니다.');
          cancelBtn.disabled = false;
        }
      });
    }
  }

  async function handleLookup(e) {
    e.preventDefault();
    const bookingNo = document.getElementById('lookupBookingNo').value.trim().toUpperCase();
    const phone4 = document.getElementById('lookupPhone4').value.trim();
    const errEl = document.getElementById('lookupError');
    errEl.style.display = 'none';
    document.getElementById('resultArea').innerHTML = '';
    if (!bookingNo || !phone4) return;

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
      lastLookup = { bookingNo, phone4 };
      const result = await api('/api/lookup', {
        method:'POST',
        body: JSON.stringify(lastLookup)
      });
      renderResult(result.booking);
    } catch (err) {
      console.error(err);
      errEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  }

  window.onLangChange = function(){ if (lastResult) renderResult(lastResult); };

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('lookupForm').addEventListener('submit', handleLookup);
  });
})();
