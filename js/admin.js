(() => {
  const DOW = ['일','월','화','수','목','금','토'];
  let token = sessionStorage.getItem('BW_ADMIN_TOKEN') || '';
  let allBookings = [];

  const $ = s => document.querySelector(s);

  async function api(url, options={}) {
    const headers = { 'Content-Type':'application/json', ...(options.headers || {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP_${res.status}`);
    return data;
  }

  function renderDow(id, course, selected) {
    $(id).innerHTML = DOW.map((label,i) => `
      <label class="dow-pill"><input type="checkbox" data-course="${course}" value="${i}" ${selected.includes(i)?'checked':''}><span>${label}</span></label>
    `).join('');
  }

  function checked(course) {
    return Array.from(document.querySelectorAll(`input[data-course="${course}"]:checked`)).map(x=>Number(x.value)).sort((a,b)=>a-b);
  }

  async function loadSettings() {
    const data = await api('/api/settings');
    const map = Object.fromEntries((data.settings || []).map(x => [x.course, x]));
    renderDow('#dowA','A',(map.A && map.A.allowed_dow) || [6]);
    renderDow('#dowB','B',(map.B && map.B.allowed_dow) || [2,4,5]);
    $('#capacityA').value = (map.A && map.A.capacity) || 20;
    $('#capacityB').value = (map.B && map.B.capacity) || 15;
  }

  async function saveSettings() {
    if (!token) return alert('먼저 관리자 인증키를 입력해 주세요.');
    const settings = [
      { course:'A', allowed_dow:checked('A'), capacity:Number($('#capacityA').value)||20 },
      { course:'B', allowed_dow:checked('B'), capacity:Number($('#capacityB').value)||15 },
    ];
    $('#msg').textContent = '저장 중...';
    await api('/api/settings', { method:'PUT', body:JSON.stringify({settings}) });
    $('#msg').textContent = '✓ 저장되었습니다. 모든 고객 기기에 공통 반영됩니다.';
    setTimeout(()=>$('#msg').textContent='',3500);
  }

  async function loadBookings() {
    if (!token) {
      $('#bookingRows').innerHTML = '<tr><td colspan="10" style="padding:30px;text-align:center;">관리자 인증 후 표시됩니다.</td></tr>';
      return;
    }
    const data = await api('/api/bookings');
    allBookings = data.bookings || [];
    renderBookings();
  }

  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

  function renderBookings() {
    const course = $('#courseFilter').value;
    const status = $('#statusFilter').value;
    const q = $('#searchInput').value.trim().toLowerCase();
    const rows = allBookings.filter(b => {
      if (course && b.course !== course) return false;
      if (status && b.status !== status) return false;
      if (q && ![b.booking_no,b.applicant_name,b.applicant_phone,b.applicant_email,b.booking_date].join(' ').toLowerCase().includes(q)) return false;
      return true;
    });

    $('#countAll').textContent = allBookings.length;
    $('#countConfirmed').textContent = allBookings.filter(b=>b.status!=='취소').length;
    $('#countA').textContent = allBookings.filter(b=>b.course==='A').length;
    $('#countB').textContent = allBookings.filter(b=>b.course==='B').length;

    if (!rows.length) {
      $('#bookingRows').innerHTML='<tr><td colspan="10" style="padding:30px;text-align:center;">예약이 없습니다.</td></tr>';
      return;
    }

    $('#bookingRows').innerHTML = rows.map(b => `
      <tr>
        <td><strong>${esc(b.booking_no)}</strong></td>
        <td>${esc(b.booking_date)}</td>
        <td>코스 ${esc(b.course)}</td>
        <td>${esc(b.people)}</td>
        <td>${esc(b.applicant_name)}</td>
        <td>${esc(b.applicant_phone)}</td>
        <td>${esc(b.applicant_email)}</td>
        <td>${esc(b.course==='A' ? (b.pet_name||'-') : (b.nationality||'-'))}</td>
        <td><span class="status ${b.status==='취소'?'cancelled':'confirmed'}">${esc(b.status)}</span></td>
        <td><button class="smallbtn" data-id="${esc(b.id)}" data-next="${b.status==='취소'?'확정':'취소'}">${b.status==='취소'?'복구':'취소'}</button></td>
      </tr>`).join('');

    document.querySelectorAll('.smallbtn[data-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const next = btn.dataset.next;
        if (!confirm(`이 예약을 '${next}' 상태로 변경할까요?`)) return;
        await api('/api/bookings', { method:'PATCH', body:JSON.stringify({id:btn.dataset.id,status:next}) });
        await loadBookings();
      });
    });
  }

  async function authenticate() {
    token = $('#adminToken').value.trim();
    if (!token) return;
    sessionStorage.setItem('BW_ADMIN_TOKEN', token);
    try {
      await loadBookings();
      $('#msg').textContent='✓ 관리자 인증 성공';
      setTimeout(()=>$('#msg').textContent='',2500);
    } catch (e) {
      console.error(e);
      $('#msg').textContent='관리자 인증키가 올바르지 않습니다.';
    }
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (token) $('#adminToken').value = token;
    $('#authBtn').addEventListener('click', authenticate);
    $('#saveScheduleBtn').addEventListener('click', () => saveSettings().catch(e => { console.error(e); alert('저장 오류: '+e.message); }));
    $('#refreshBtn').addEventListener('click', () => loadBookings().catch(e => { console.error(e); alert('조회 오류: '+e.message); }));
    $('#courseFilter').addEventListener('change', renderBookings);
    $('#statusFilter').addEventListener('change', renderBookings);
    $('#searchInput').addEventListener('input', renderBookings);
    try { await loadSettings(); } catch(e) { console.error(e); $('#msg').textContent='DB 설정 연결 전입니다.'; }
    if (token) { try { await loadBookings(); } catch(e) { console.error(e); } }
  });
})();
