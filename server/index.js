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

    const old = await storage.getFeed(module);
    const oldIds = new Set(old.map((x) => x.id));
    const merged = new Map(old.map((x) => [x.id, x]));

    // 1) 先拉最新一页，捕捉新发布的内容
    const latest = await rss.fetchModule(module, sources, { pages: 1 });
    latest.forEach((it) => {
      const o = merged.get(it.id);
      if (o) { it.read = o.read; it.saved = o.saved; }
      merged.set(it.id, it);
    });
    const newFromLatest = latest.filter((it) => !oldIds.has(it.id)).length;

    // 2) 若顶部没有新内容，回溯更旧的页，保证每次刷新都能拉到"再之前一点"的信息
    if (newFromLatest === 0) {
      const meta = await storage.getFeedMeta(module);
      let page = (meta.page || 1) + 1;
      const MAX_BACKFILL = 3;
      for (let i = 0; i < MAX_BACKFILL; i++) {
        const older = await rss.fetchModule(module, sources, { pages: 1, startPage: page });
        let fresh = 0;
        older.forEach((it) => { if (!merged.has(it.id)) { merged.set(it.id, it); fresh++; } });
        if (fresh === 0) break; // 源不支持分页或已到头
        page++;
      }
      await storage.saveFeedMeta(module, { page: page - 1 });
    }

    // 3) 排序 + 容量上限，写回
    let items = [...merged.values()].sort((a, b) => new Date(b.date) - new Date(a.date));
    const CAP = 200;
    if (items.length > CAP) items = items.slice(0, CAP);
    await storage.saveFeed(module, items);

    // 4) 返回完整列表 + 本次新增条数（前端不再用"与上次内容相同"）
    const newCount = items.filter((it) => !oldIds.has(it.id)).length;
    res.json({ items, newCount });
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
