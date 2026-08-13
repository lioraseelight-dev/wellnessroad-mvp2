/* ============================================================
   부산 5색 웰니스 워크 — 관리자 대시보드 로직
   ============================================================ */
(function () {
  const ADMIN_PASSWORD = 'wellness2026';
  const SESSION_KEY = 'bw_admin_authed';

  let allBookings = [];
  let chartInstance = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function courseLabel(course) {
    return course === 'A' ? '댕댕오감학교' : 'K-웰니스 부산워크';
  }

  function detailSummary(b) {
    if (b.course === 'A') {
      return `🐾 ${b.petName || '-'} / ${b.petBreed || '-'} / ${b.petSize || '-'} / 사회성:${b.petSociality || '-'}`;
    }
    return `🌍 ${b.nationality || '-'} / ${b.guideLanguage || '-'} / 한복:${b.hanbokSize || '-'} / 식이:${b.dietRestriction || '없음'}`;
  }

  function formatDateTime(ms) {
    if (!ms) return '-';
    const d = new Date(Number(ms));
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------------- 게이트 ---------------- */
  function initGate() {
    const gate = $('#adminGate');
    const dashboard = $('#adminDashboard');

    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      gate.style.display = 'none';
      dashboard.style.display = 'block';
      loadAndRender();
    }

    $('#gateForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = $('#gatePassword').value;
      if (val === ADMIN_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, '1');
        gate.style.display = 'none';
        dashboard.style.display = 'block';
        loadAndRender();
      } else {
        $('#gateError').style.display = 'block';
      }
    });

    $('#logoutBtn').addEventListener('click', () => {
      sessionStorage.removeItem(SESSION_KEY);
      dashboard.style.display = 'none';
      gate.style.display = 'flex';
      $('#gatePassword').value = '';
    });
  }

  /* ---------------- 데이터 로드 & 렌더 ---------------- */
  async function loadAndRender() {
    try {
      allBookings = await BW.listBookings();
      allBookings.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      renderSummary();
      renderChart();
      populateDateFilter();
      renderTable();
    } catch (e) {
      console.error(e);
      alert('예약 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  }

  function renderSummary() {
    const active = allBookings.filter(b => b.status !== '취소');
    const totalCount = active.length;
    const aCount = active.filter(b => b.course === 'A').length;
    const bCount = active.filter(b => b.course === 'B').length;
    const totalPeople = active.reduce((sum, b) => sum + (Number(b.people) || 0), 0);
    const dogCount = aCount; // 코스A는 1건=1견 기준(반려견 동반 필수, 1인+1견)

    $('#statTotal').textContent = totalCount;
    $('#statA').textContent = aCount;
    $('#statADogs').textContent = `반려견 ${dogCount}마리`;
    $('#statB').textContent = bCount;
    $('#statPeople').textContent = totalPeople;
  }

  function renderChart() {
    const active = allBookings.filter(b => b.status !== '취소');
    const aCount = active.filter(b => b.course === 'A').length;
    const bCount = active.filter(b => b.course === 'B').length;
    const ctx = document.getElementById('courseChart');
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['코스A · 댕댕오감학교', '코스B · K-웰니스 부산워크'],
        datasets: [{
          data: [aCount, bCount],
          backgroundColor: ['#E8745C', '#1B6791'],
          borderWidth: 0,
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } },
        cutout: '62%',
      }
    });
  }

  function populateDateFilter() {
    const dates = Array.from(new Set(allBookings.map(b => b.date))).sort();
    const sel = $('#filterDate');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">전체 날짜</option>' + dates.map(d => `<option value="${d}">${d}</option>`).join('');
    sel.value = currentVal;
  }

  function getFilteredBookings() {
    const course = $('#filterCourse').value;
    const date = $('#filterDate').value;
    const status = $('#filterStatus').value;
    return allBookings.filter(b => {
      if (course && b.course !== course) return false;
      if (date && b.date !== date) return false;
      if (status && b.status !== status) return false;
      return true;
    });
  }

  function renderTable() {
    const list = getFilteredBookings();
    const tbody = $('#adminTableBody');
    const emptyMsg = $('#emptyTableMsg');

    if (list.length === 0) {
      tbody.innerHTML = '';
      emptyMsg.style.display = 'block';
      return;
    }
    emptyMsg.style.display = 'none';

    tbody.innerHTML = list.map(b => `
      <tr>
        <td style="font-weight:700;">${b.bookingNo || '-'}</td>
        <td><span class="tag-course ${b.course}">${b.course} · ${courseLabel(b.course)}</span></td>
        <td>${b.date || '-'}</td>
        <td>${b.people ?? '-'}</td>
        <td>${b.name || '-'}</td>
        <td>${b.phone || '-'}</td>
        <td>${b.email || '-'}</td>
        <td style="max-width:260px; white-space:normal;">${detailSummary(b)}</td>
        <td>${b.status === '취소' ? '<span class="status-badge cancelled">취소</span>' : '<span class="status-badge confirmed">확정</span>'}</td>
        <td>${formatDateTime(b.created_at)}</td>
      </tr>
    `).join('');
  }

  /* ---------------- CSV 다운로드 ---------------- */
  function downloadCSV() {
    const headers = ['예약번호', '코스', '날짜', '인원', '신청자', '연락처', '이메일', '세부정보', '상태', '신청일시'];
    const rows = allBookings.map(b => [
      b.bookingNo, `${b.course} · ${courseLabel(b.course)}`, b.date, b.people, b.name, b.phone, b.email,
      detailSummary(b).replace(/,/g, ' /'), b.status, formatDateTime(b.created_at)
    ]);
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    a.href = url;
    a.download = `bw_bookings_${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initGate();
    $('#refreshBtn').addEventListener('click', loadAndRender);
    $('#csvDownloadBtn').addEventListener('click', downloadCSV);
    ['#filterCourse', '#filterDate', '#filterStatus'].forEach(sel => {
      $(sel).addEventListener('change', renderTable);
    });
  });
})();
