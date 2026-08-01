/**
 * Vercel serverless proxy → Delhivery CMU create shipment API.
 * POST /api/delhivery-shipment
 *
 * Body (JSON): { formBody: "format=json&data=...", upstreamBase?: string }
 * Header: Authorization: Token <delhivery-api-token>
 */

const UPSTREAM_PATH = 'cmu/create.json';
const DEFAULT_API_ROOT = 'https://track.delhivery.com/api';

async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                resolve(raw ? JSON.parse(raw) : {});
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    const auth = req.headers.authorization;
    if (!auth) {
        return sendJson(res, 401, { error: 'Missing Authorization header' });
    }

    let parsed;
    try {
        parsed = await readJsonBody(req);
    } catch {
        return sendJson(res, 400, { error: 'Invalid JSON body' });
    }

    const formBody = typeof parsed.formBody === 'string' ? parsed.formBody : '';
    if (!formBody) {
        return sendJson(res, 400, { error: 'Missing formBody in request' });
    }

    const base = (parsed.upstreamBase || process.env.DELHIVERY_API_BASE_URL || DEFAULT_API_ROOT).replace(
        /\/$/,
        ''
    );
    const targetUrl = `${base}/${UPSTREAM_PATH}`;

    try {
        const upstream = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                Authorization: auth,
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            },
            body: formBody,
        });

        const text = await upstream.text();
        res.status(upstream.status);
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
        res.end(text);
    } catch (err) {
        console.error('[delhivery-shipment]', targetUrl, err);
        sendJson(res, 502, {
            error: 'Failed to reach Delhivery API',
            message: err.message || String(err),
        });
    }
}

function sendJson(res, status, payload) {
    res.status(status);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
}
