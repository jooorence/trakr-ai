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
  const REDIRECT_URI = 'https://trakros.com/oura-callback';

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
      const [sleep, activity, readiness] = await Promise.all([
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_sleep'     + dateParams, method: 'GET', headers: authHeader }),
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_activity'  + dateParams, method: 'GET', headers: authHeader }),
        httpsRequest({ hostname: 'api.ouraring.com', path: '/v2/usercollection/daily_readiness' + dateParams, method: 'GET', headers: authHeader })
      ]);
      return {
        statusCode: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleep, activity, readiness })
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
