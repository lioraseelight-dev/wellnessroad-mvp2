const { db, send, cleanPhone } = require('./_supabase');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    const bookingNo = String((req.body || {}).bookingNo || '').trim().toUpperCase();
    const phone4 = cleanPhone((req.body || {}).phone4 || '');
    if (!bookingNo || phone4.length !== 4) return send(res, 400, { error: 'INVALID_LOOKUP' });

    const rows = await db(
      `bookings?booking_no=eq.${encodeURIComponent(bookingNo)}&select=*&limit=1`
    );
    const b = rows && rows[0];
    if (!b || cleanPhone(b.applicant_phone).slice(-4) !== phone4) {
      return send(res, 404, { error: 'NOT_FOUND' });
    }

    return send(res, 200, {
      booking: {
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
      }
    });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message, detail: e.body || null });
  }
};
