const https = require('https');
const querystring = require('querystring');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://trakros.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
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

  const params = event.queryStringParameters || {};
  const action = params.action;
  const CLIENT_ID = process.env.OURA_CLIENT_ID;
  const CLIENT_SECRET = process.env.OURA_CLIENT_SECRET;
  const REDIRECT_URI = 'https://trakros.com';

  try {
    // --- auth_url: return the Oura OAuth authorization URL ---
    if (action === 'auth_url') {
      const url = 'https://cloud.ouraring.com/oauth/authorize'
        + '?response_type=code'
        + '&client_id=' + encodeURIComponent(CLIENT_ID)
        + '&redirect_uri=' + encodeURIComponent(REDIRECT_URI)
        + '&scope=daily+personal+heartrate+session+workout';
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      };
    }

    // --- callback: exchange authorization code for access token ---
    if (action === 'callback') {
      const code = params.code;
      if (!code) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing code parameter' })
        };
      }
      const body = querystring.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: REDIRECT_URI
      });
      const data = await httpsRequest({
        hostname: 'api.ouraring.com',
        path: '/oauth/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body)
        }
      }, body);
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    // --- fetch: retrieve today's sleep, activity, and readiness data ---
    if (action === 'fetch') {
      const token = params.token;
      if (!token) {
        return {
          statusCode: 400,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Missing token parameter' })
        };
      }
      const today = new Date().toISOString().split('T')[0];
      const dateParams = '?start_date=' + today + '&end_date=' + today;
      const authHeader = { 'Authorization': 'Bearer ' + token };
      // daily_sleep gives us `score` (a contributor-weighted number).
      // sleep gives us session-level fields: total_sleep_duration, sleep_efficiency,
      //   deep/rem/light durations, average_hrv, bedtime_start, bedtime_end.
      // We fetch both and merge so the UI gets everything in one payload.
      const [dailySleep, sessionSleep, activity, readiness] = await Promise.all([
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_sleep'     + dateParams, method: 'GET', headers: authHeader }),
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/sleep'           + dateParams, method: 'GET', headers: authHeader }),
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_activity'  + dateParams, method: 'GET', headers: authHeader }),
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_readiness' + dateParams, method: 'GET', headers: authHeader })
      ]);
      // Merge: keep daily_sleep's `data` shape for backwards compat, but enrich
      // each entry with the matching session sleep's duration/efficiency fields.
      const merged = JSON.parse(JSON.stringify(dailySleep || {}));
      const sessions = (sessionSleep && sessionSleep.data) || [];
      // Pick the longest session for the day (Oura can return naps + main sleep).
      const longest = sessions.reduce((a, b) => {
        const aDur = (a && a.total_sleep_duration) || 0;
        const bDur = (b && b.total_sleep_duration) || 0;
        return bDur > aDur ? b : a;
      }, null);
      if (merged.data && merged.data[0] && longest) {
        Object.assign(merged.data[0], {
          total_sleep_duration: longest.total_sleep_duration,
          // index.html does Math.round(sleep.sleep_efficiency * 100), so we
          // convert Oura's 0–100 percentage into a 0–1 ratio here.
          sleep_efficiency:     longest.efficiency != null ? longest.efficiency / 100 : null,
          deep_sleep_duration:  longest.deep_sleep_duration,
          rem_sleep_duration:   longest.rem_sleep_duration,
          light_sleep_duration: longest.light_sleep_duration,
          average_hrv:          longest.average_hrv,
          bedtime_start:        longest.bedtime_start,
          bedtime_end:          longest.bedtime_end
        });
      }
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleep: merged, activity, readiness })
      };
    }

    // --- unknown action ---
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid action. Use ?action=auth_url, callback, or fetch' })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
