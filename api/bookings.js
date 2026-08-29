const { db, send, requireAdmin } = require('./_supabase');

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      requireAdmin(req);
      const rows = await db(
        'bookings?select=*&order=created_at.desc&limit=1000'
      );
      return send(res, 200, { bookings: rows || [] });
    }

    if (req.method === 'POST') {
      const b = req.body || {};
      const course = String(b.course || '').toUpperCase();
      const people = Number(b.people);

      if (!['A','B'].includes(course)) return send(res, 400, { error: 'INVALID_COURSE' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.date || ''))) return send(res, 400, { error: 'INVALID_DATE' });
      if (!Number.isInteger(people) || people < 1 || people > 20) return send(res, 400, { error: 'INVALID_PEOPLE' });
      if (!String(b.name || '').trim() || !String(b.phone || '').trim() || !String(b.email || '').trim()) {
        return send(res, 400, { error: 'APPLICANT_REQUIRED' });
      }
      if (b.consent !== true) return send(res, 400, { error: 'CONSENT_REQUIRED' });

      const payload = {
        p_course: course,
        p_course_option: String(b.courseOption || ''),
        p_booking_date: b.date,
        p_people: people,
        p_applicant_name: String(b.name).trim(),
        p_applicant_phone: String(b.phone).trim(),
        p_applicant_email: String(b.email).trim(),
        p_consent: true,
        p_pet_name: b.petName || null,
        p_pet_breed: b.petBreed || null,
        p_pet_size: b.petSize || null,
        p_pet_vaccinated: typeof b.petVaccinated === 'boolean' ? b.petVaccinated : null,
        p_pet_sociality: b.petSociality || null,
        p_nationality: b.nationality || null,
        p_guide_language: b.guideLanguage || null,
        p_hanbok_size: b.hanbokSize || null,
        p_diet_restriction: b.dietRestriction || null,
      };

      const created = await db('rpc/create_booking_atomic', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(payload),
      });

      const row = Array.isArray(created) ? created[0] : created;
      return send(res, 201, { booking: row });
    }

    if (req.method === 'PATCH') {
      requireAdmin(req);
      const b = req.body || {};
      const id = String(b.id || '');
      const status = String(b.status || '');
      if (!id || !['확정','취소'].includes(status)) return send(res, 400, { error: 'INVALID_PATCH' });

      const rows = await db(`bookings?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      return send(res, 200, { booking: rows && rows[0] ? rows[0] : null });
    }

    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  } catch (e) {
    console.error(e);
    const message = String(e.message || '');
    if (message.includes('CAPACITY_FULL')) return send(res, 409, { error: 'CAPACITY_FULL' });
    if (message.includes('DATE_NOT_ALLOWED')) return send(res, 400, { error: 'DATE_NOT_ALLOWED' });
    return send(res, e.status || 500, { error: message, detail: e.body || null });
  }
};
