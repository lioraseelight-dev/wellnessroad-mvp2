function env(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function supabaseHeaders(extra = {}) {
  const key = env('SUPABASE_SECRET_KEY');
  const headers = {
    'Content-Type': 'application/json',
    'apikey': key,
    ...extra,
  };
  // Legacy service_role JWTs also accept Authorization Bearer.
  if (key.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

async function db(path, options = {}) {
  const url = `${env('SUPABASE_URL').replace(/\/$/, '')}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: supabaseHeaders(options.headers || {}),
  });
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  if (!res.ok) {
    const err = new Error(
      (body && (body.message || body.error || body.hint)) ||
      `Supabase request failed (${res.status})`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

function send(res, status, data) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function requireAdmin(req) {
  const expected = process.env.ADMIN_API_TOKEN || '';
  const auth = req.headers.authorization || '';
  if (!expected || auth !== `Bearer ${expected}`) {
    const err = new Error('UNAUTHORIZED');
    err.status = 401;
    throw err;
  }
}

function cleanPhone(v) {
  return String(v || '').replace(/[^0-9]/g, '');
}

module.exports = { db, send, requireAdmin, cleanPhone };
