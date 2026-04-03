const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const STATIC_DIR = __dirname;
const ORIGIN = 'obamaoralhistory.columbia.edu';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
};

function proxyToOrigin(req, res) {
  const options = {
    hostname: ORIGIN,
    path: req.url,
    method: req.method,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': req.headers['accept'] || '*/*',
      'Accept-Encoding': 'identity',
      'Host': ORIGIN,
    },
  };
  const proxyReq = https.request(options, (proxyRes) => {
    // Handle redirects
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      res.writeHead(302, { 'Location': proxyRes.headers.location, 'Access-Control-Allow-Origin': '*' });
      res.end();
      return;
    }
    const headers = {
      'Content-Type': proxyRes.headers['content-type'] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=86400',
    };
    res.writeHead(proxyRes.statusCode, headers);
    proxyRes.pipe(res);
  });
  proxyReq.on('error', (e) => { res.writeHead(502); res.end('Proxy Error: ' + e.message); });
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsed.pathname);
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Local video/image files
  if (pathname.startsWith('/media/')) {
    const filePath = path.join(STATIC_DIR, pathname.replace('/media/', ''));
    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
  }

  // Local CSS/JS override
  if (pathname === '/public/theme/styles.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    fs.createReadStream(path.join(STATIC_DIR, 'styles.css')).pipe(res);
    return;
  }
  if (pathname === '/public/theme/libs.min.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    fs.createReadStream(path.join(STATIC_DIR, 'libs.min.js')).pipe(res);
    return;
  }
  if (pathname === '/public/theme/scripts.min.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    fs.createReadStream(path.join(STATIC_DIR, 'scripts.min.js')).pipe(res);
    return;
  }

  // Serve index
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(STATIC_DIR, '..', 'obama-home.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(htmlPath).pipe(res);
      return;
    }
  }

  // Everything else → proxy to original site
  proxyToOrigin(req, res);
});

const PORT = 4000;
server.listen(PORT, () => {
  console.log(`✅ http://localhost:${PORT}`);
  console.log(`📦 Obama Oral History 로컬 서빙 + 원본 프록시`);
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    server.listen(PORT + 1, () => {
      console.log(`✅ http://localhost:${PORT + 1}`);
    });
  }
});
