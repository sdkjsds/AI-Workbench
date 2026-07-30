const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');

const storage = require('./src/storage');
const rss = require('./src/rss');
const ai = require('./src/ai');
const article = require('./src/article');
const ocr = require('./src/ocr');

const app = express();
app.use(cors());
app.use(express.json());

const PUBLIC_DIR = path.join(__dirname, 'public');
// 前端依赖库（marked 等）从 server 自身的 node_modules 提供
app.use('/vendor', express.static(path.join(__dirname, 'node_modules')));
// 随手记图片
app.use('/images', express.static(storage.imgDir()));
// 前端静态资源
app.use(express.static(PUBLIC_DIR));

const MODULES = ['knowledge', 'gongkao', 'licai', 'dressing'];
function isModule(m) { return MODULES.includes(m); }

// ---------- 设置 ----------
app.get('/api/settings', async (req, res) => {
  const s = await storage.getSettings();
  // 不向前端泄露环境变量提供的密钥
  if (s._envProvided && s._envProvided.aiApiKey) s.aiApiKey = '';
  res.json(s);
});
app.post('/api/settings', async (req, res) => {
  try {
    const s = await storage.saveSettings(req.body || {});
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- RSS 卡片流 ----------
app.get('/api/feed/:module', async (req, res) => {
  if (!isModule(req.params.module)) return res.status(400).json({ error: 'bad module' });
  res.json(await storage.getFeed(req.params.module));
});
app.post('/api/feed/:module/refresh', async (req, res) => {
  const module = req.params.module;
  if (!isModule(module)) return res.status(400).json({ error: 'bad module' });
  try {
    const settings = await storage.getSettings();
    const sources = (settings.sources && settings.sources[module] && settings.sources[module].length)
      ? settings.sources[module]
      : rss.defaultSources(module);
    const items = await rss.fetchModule(module, sources);
    const old = await storage.getFeed(module);
    const oldMap = new Map(old.map((x) => [x.id, x]));
    items.forEach((it) => {
      const o = oldMap.get(it.id);
      if (o) { it.read = o.read; it.saved = o.saved; }
    });
    await storage.saveFeed(module, items);
    res.json(items);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/feed/:module/markread', async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'no id' });
  await storage.markRead(req.params.module, id);
  res.json({ ok: true });
});

// ---------- 每日新知 ----------
app.get('/api/stories', async (req, res) => {
  res.json(await storage.getStories());
});
app.post('/api/story/generate', async (req, res) => {
  try {
    const s = await ai.generateDailyStory();
    res.json(s);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- 穿搭灵感 ----------
app.get('/api/dressing/stories', async (req, res) => {
  res.json(await storage.getDressingStories());
});
app.post('/api/dressing/generate', async (req, res) => {
  try {
    const s = await ai.generateDressingInspiration();
    res.json(s);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- 文章 AI 简述 ----------
app.post('/api/article/brief', async (req, res) => {
  const { title, summary } = req.body || {};
  if (!title && !summary) return res.status(400).json({ error: 'no content' });
  try {
    const brief = await ai.briefArticle(title || '', summary || '');
    res.json({ brief });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ---------- 随手记 ----------
app.get('/api/screenshots', async (req, res) => {
  res.json(await storage.getScreenshots());
});
app.post('/api/screenshots/text', async (req, res) => {
  const { content, tags } = req.body || {};
  if (!content) return res.status(400).json({ error: 'no content' });
  res.json(await storage.addTextNote(content, tags || []));
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, storage.imgDir()),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      cb(null, crypto.randomBytes(8).toString('hex') + ext);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});
app.post('/api/screenshots/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });
    let ocrText = '';
    try { ocrText = await ocr.recognize(req.file.path); }
    catch (e) { console.warn('OCR failed:', e.message); }
    const meta = await storage.addImageShot(req.file.filename, req.file.originalname, ocrText);
    res.json(meta);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/screenshots/:id', async (req, res) => {
  const m = await storage.updateScreenshot(req.params.id, req.body || {});
  if (!m) return res.status(404).json({ error: 'not found' });
  res.json(m);
});

// ---------- 文章正文提取 ----------
app.get('/api/article', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: 'no url' });
  try {
    const a = await article.fetchArticle(url);
    res.json(a);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ---------- SPA 兜底 ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

const PORT = process.env.PORT || 3000;
storage.init().then(() => {
  app.listen(PORT, () => {
    console.log(`知流 server 已启动: http://localhost:${PORT}`);
  });
}).catch((e) => {
  console.error('存储初始化失败:', e);
  process.exit(1);
});
