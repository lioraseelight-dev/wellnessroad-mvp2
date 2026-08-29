const { db, send, requireAdmin } = require('./_supabase');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await db('booking_settings?select=course,allowed_dow,capacity,updated_at&order=course.asc');
      return send(res, 200, { settings: rows || [] });
    }

    if (req.method === 'PUT') {
      requireAdmin(req);
      const body = req.body || {};
      const rows = Array.isArray(body.settings) ? body.settings : [];
      const cleaned = rows
        .filter(r => r && ['A','B'].includes(r.course))
        .map(r => ({
          course: r.course,
          allowed_dow: Array.from(new Set((r.allowed_dow || []).map(Number)))
            .filter(n => Number.isInteger(n) && n >= 0 && n <= 6)
            .sort((a,b) => a-b),
          capacity: Math.max(1, Number(r.capacity) || (r.course === 'A' ? 20 : 15)),
          updated_at: new Date().toISOString(),
        }));

      if (cleaned.length !== 2) return send(res, 400, { error: 'A_AND_B_REQUIRED' });

      const saved = await db('booking_settings?on_conflict=course', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(cleaned),
      });
      return send(res, 200, { settings: saved });
    }

    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (e) {
    console.error(e);
    return send(res, e.status || 500, { error: e.message, detail: e.body || null });
  }
};
