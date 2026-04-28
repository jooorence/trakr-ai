const https = require('https');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(statusCode, obj) {
  return {
    statusCode: statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(body);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'Invalid JSON' });
  }

  if (body.secret !== process.env.TRAKR_SECRET) {
    return jsonResponse(401, { error: 'Unauthorized' });
  }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonResponse(400, { error: 'Missing or invalid date (expected YYYY-MM-DD)' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return jsonResponse(500, { error: 'Supabase env not configured' });
  }

  const apple_fitness = {
    move: Number(body.move) || 0,
    exercise: Number(body.exercise) || 0,
    stand: Number(body.stand) || 0,
    steps: Number(body.steps) || 0,
    date: date
  };

  // PostgREST upsert: insert or update the matching row by `date`.
  // Only the columns we send are updated — food_log, water_oz, oura, etc. are preserved.
  const payload = JSON.stringify({
    date: date,
    apple_fitness: apple_fitness,
    updated_at: new Date().toISOString()
  });

  const supabaseHost = new URL(SUPABASE_URL).hostname;
  const options = {
    hostname: supabaseHost,
    path: '/rest/v1/daily_logs?on_conflict=date',
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates,return=minimal',
      'Content-Length': Buffer.byteLength(payload)
    }
  };

  try {
    const result = await httpsRequest(options, payload);
    if (result.status >= 200 && result.status < 300) {
      return jsonResponse(200, { ok: true, date: date, apple_fitness: apple_fitness });
    }
    return jsonResponse(result.status, { error: 'Supabase upsert failed', detail: result.body });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};
