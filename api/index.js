const app = require('../backend/src/index.js');
const http = require('http');
const https = require('https');
const url = require('url');

module.exports = (req, res) => {
  // Global CORS Headers for Vercel Serverless Function execution
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // If RENDER_BACKEND_URL environment variable is set, dynamically proxy request to the Render backend
  if (process.env.RENDER_BACKEND_URL) {
    const targetBase = process.env.RENDER_BACKEND_URL.replace(/\/$/, '');
    const path = req.url.startsWith('/') ? req.url : `/${req.url}`;
    const targetUrl = `${targetBase}${path}`;
    const parsedUrl = url.parse(targetUrl);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const headers = { ...req.headers };
    headers.host = parsedUrl.host;

    const proxyReq = client.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: req.method,
      headers: headers
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
      console.error('[Vercel Proxy Error]:', err);
      res.status(500).json({ error: 'Proxy Request Failed', details: err.message });
    });

    if (req.body && (typeof req.body === 'object' && Object.keys(req.body).length > 0 || typeof req.body === 'string')) {
      const bodyData = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
      proxyReq.end();
    } else {
      req.pipe(proxyReq, { end: true });
    }
    return;
  }
  
  return app(req, res);
};
