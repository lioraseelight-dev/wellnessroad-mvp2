const { db, send, cleanPhone } = require('./_supabase');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    const bookingNo = String((req.body || {}).bookingNo || '').trim().toUpperCase();
    const phone4 = cleanPhone((req.body || {}).phone4 || '');
    if (!bookingNo || phone4.length !== 4) return send(res, 400, { error: 'INVALID_CANCEL' });

    const rows = await db(
      `bookings?booking_no=eq.${encodeURIComponent(bookingNo)}&select=id,applicant_phone,status&limit=1`
    );
    const b = rows && rows[0];
    if (!b || cleanPhone(b.applicant_phone).slice(-4) !== phone4) {
      return send(res, 404, { error: 'NOT_FOUND' });
    }

    const updated = await db(`bookings?id=eq.${encodeURIComponent(b.id)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ status: '취소', updated_at: new Date().toISOString() }),
    });
    return send(res, 200, { booking: updated && updated[0] ? updated[0] : null });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message, detail: e.body || null });
  }
};
