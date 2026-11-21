'use strict';
// YouTube 每日热门 — 零依赖 Node 服务
// 环境变量: YT_API_KEY (必填, YouTube Data API v3 key), PORT (默认 3000)
// 运行时不写任何文件: Hostless 运行环境的文件系统是只读的,
// 所以数据只放内存缓存, 不写 data.json、不写日志文件、不 mkdir。

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const CACHE_TTL_MS = 30 * 60 * 1000; // 缓存 30 分钟
const API_TIMEOUT_MS = 15000;
const MAX_RESULTS = 25;

const REGIONS = ['SG', 'US', 'JP', 'TW', 'KR', 'GB'];

const INDEX_HTML = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// 内存缓存: key 为 "地区:分类" -> { at: 时间戳, data: 返回给前端的 payload }
const cache = new Map();

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// 把 YouTube API 的原始响应转成前端要的精简形状。
function transformItems(apiJson) {
  const items = Array.isArray(apiJson.items) ? apiJson.items : [];
  return items.map((it) => {
    const s = it.snippet || {};
    const st = it.statistics || {};
    const th = s.thumbnails || {};
    const thumbnail =
      (th.medium && th.medium.url) ||
      (th.high && th.high.url) ||
      (th.default && th.default.url) ||
      '';
    return {
      id: it.id || '',
      title: s.title || '',
      channelTitle: s.channelTitle || '',
      channelId: s.channelId || '',
      thumbnail,
      views: numOrNull(st.viewCount),
      likes: numOrNull(st.likeCount),
      comments: numOrNull(st.commentCount),
      publishedAt: s.publishedAt || '',
      categoryId: s.categoryId || '',
    };
  });
}

function fetchTrending(region, category) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      part: 'snippet,statistics',
      chart: 'mostPopular',
      regionCode: region,
      maxResults: String(MAX_RESULTS),
      key: process.env.YT_API_KEY,
    });
    if (category) params.set('videoCategoryId', category);
    const url = 'https://www.googleapis.com/youtube/v3/videos?' + params.toString();
    const req = https.get(url, { timeout: API_TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        let data;
        try {
          data = JSON.parse(body);
        } catch (e) {
          return reject(new Error('YouTube 返回了无法解析的响应'));
        }
        if (res.statusCode !== 200) {
          const msg = (data.error && data.error.message) || ('HTTP ' + res.statusCode);
          return reject(new Error('YouTube API 错误: ' + msg));
        }
        resolve(data);
      });
    });
    req.on('timeout', () => { req.destroy(new Error('请求 YouTube 超时')); });
    req.on('error', (err) => { reject(new Error('请求 YouTube 失败: ' + err.message)); });
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

async function handleTrending(reqUrl, res) {
  const regionRaw = (reqUrl.searchParams.get('region') || 'SG').toUpperCase();
  const region = REGIONS.includes(regionRaw) ? regionRaw : 'SG';
  const catRaw = reqUrl.searchParams.get('category') || '';
  const category = /^\d+$/.test(catRaw) ? catRaw : '';
  const key = region + ':' + category;

  if (!process.env.YT_API_KEY) {
    return sendJson(res, 200, {
      error: 'missing_key',
      message: '未设置 YT_API_KEY 环境变量,请在部署平台的环境变量里配置 YouTube Data API v3 的 key。',
    });
  }

  const now = Date.now();
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_TTL_MS) {
    return sendJson(res, 200, hit.data);
  }

  try {
    const data = await fetchTrending(region, category);
    const payload = {
      updatedAt: new Date().toISOString(),
      region,
      category,
      items: transformItems(data),
    };
    cache.set(key, { at: now, data: payload });
    sendJson(res, 200, payload);
  } catch (err) {
    if (hit) {
      // API 报错(比如额度用完)时,有旧缓存就继续返回旧数据,并标明是过期数据。
      return sendJson(res, 200, Object.assign({}, hit.data, {
        stale: true,
        error: 'api_error',
        message: err.message,
      }));
    }
    sendJson(res, 502, { error: 'api_error', message: err.message });
  }
}

const server = http.createServer((req, res) => {
  let reqUrl;
  try {
    reqUrl = new URL(req.url, 'http://localhost');
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ error: 'bad_request' }));
  }
  if (req.method === 'GET' && reqUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(INDEX_HTML);
  }
  if (req.method === 'GET' && reqUrl.pathname === '/api/trending') {
    return handleTrending(reqUrl, res).catch((err) => {
      sendJson(res, 500, { error: 'server_error', message: String((err && err.message) || err) });
    });
  }
  if (reqUrl.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'not_found' }));
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log('yt-trending listening on http://' + HOST + ':' + PORT);
  });
}

module.exports = { transformItems, fetchTrending, server };
