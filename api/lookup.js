const { db, send, cleanPhone } = require('./_supabase');

function phoneVariants(phone) {
  return Array.from(new Set([
    phone,
    `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`
  ]));
}

function toPublicBooking(b) {
  return {
    id: b.id,
    bookingNo: b.booking_no,
    course: b.course,
    courseOption: b.course_option,
    date: b.booking_date,
    people: b.people,
    name: b.applicant_name,
    phone: b.applicant_phone,
    status: b.status,
    petName: b.pet_name,
    petSize: b.pet_size,
    nationality: b.nationality,
    hanbokSize: b.hanbok_size,
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    }

    const phone = cleanPhone((req.body || {}).phone || '');
    if (phone.length !== 11) {
      return send(res, 400, { error: 'INVALID_PHONE' });
    }

    // 예약 단계에서 전화번호가 "01012345678" 또는 "010-1234-5678"
    // 두 형태 중 어느 쪽으로 저장되어 있어도 조회되도록 합니다.
    const variants = phoneVariants(phone);
    const found = [];
    const seen = new Set();

    for (const value of variants) {
      const rows = await db(
        `bookings?applicant_phone=eq.${encodeURIComponent(value)}&select=*&order=booking_date.desc,created_at.desc&limit=100`
      );

      for (const row of (rows || [])) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          found.push(row);
        }
      }
    }

    // 혹시 과거 데이터에 공백/괄호 등 다른 형식으로 저장된 경우를 위한 보조 조회
    if (found.length === 0) {
      const recent = await db(
        'bookings?select=*&order=created_at.desc&limit=1000'
      );
      for (const row of (recent || [])) {
        if (cleanPhone(row.applicant_phone) === phone && !seen.has(row.id)) {
          seen.add(row.id);
          found.push(row);
        }
      }
    }

    if (found.length === 0) {
      return send(res, 404, { error: 'NOT_FOUND' });
    }

    found.sort((a, b) => {
      const dateCmp = String(b.booking_date || '').localeCompare(String(a.booking_date || ''));
      if (dateCmp !== 0) return dateCmp;
      return String(b.created_at || '').localeCompare(String(a.created_at || ''));
    });

    return send(res, 200, {
      bookings: found.map(toPublicBooking)
    });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, {
      error: e.message,
      detail: e.body || null
    });
  }
};
