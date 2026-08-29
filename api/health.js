const { send } = require('./_supabase');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  try {
    const hasUrl = !!process.env.SUPABASE_URL;
    const hasKey = !!process.env.SUPABASE_SECRET_KEY;
    const hasAdmin = !!process.env.ADMIN_API_TOKEN;
    return send(res, 200, {
      ok: hasUrl && hasKey && hasAdmin,
      env: { SUPABASE_URL: hasUrl, SUPABASE_SECRET_KEY: hasKey, ADMIN_API_TOKEN: hasAdmin }
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message });
  }
};
