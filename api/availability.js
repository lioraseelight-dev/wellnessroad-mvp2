const { db, send } = require('./_supabase');

module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'GET') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });

    const course = String(req.query.course || '').toUpperCase();
    const from = String(req.query.from || '');
    const to = String(req.query.to || '');
    if (!['A','B'].includes(course) || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return send(res, 400, { error: 'INVALID_QUERY' });
    }

    const settings = await db(
      `booking_settings?course=eq.${course}&select=course,allowed_dow,capacity&limit=1`
    );
    if (!settings || !settings[0]) return send(res, 404, { error: 'SETTING_NOT_FOUND' });

    const rows = await db(
      `bookings?course=eq.${course}&booking_date=gte.${from}&booking_date=lte.${to}&status=neq.%EC%B7%A8%EC%86%8C&select=booking_date,people`
    );

    const used = {};
    for (const row of (rows || [])) {
      used[row.booking_date] = (used[row.booking_date] || 0) + (Number(row.people) || 0);
    }

    return send(res, 200, {
      course,
      allowedDow: settings[0].allowed_dow || [],
      capacity: settings[0].capacity,
      used,
    });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message, detail: e.body || null });
  }
};
