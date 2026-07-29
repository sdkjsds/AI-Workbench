const state = { settings: null, feeds: {}, stories: [], screenshots: [], knowledgeTab: 'stories' };
const TITLES = { overview: '总览', knowledge: '知识流', gongkao: '公考·政治理论', licai: '理财·经济', screenshots: '随手记', settings: '设置' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showFatal(msg) {
  const v = document.getElementById('view');
  if (v) v.innerHTML = '<div class="card" style="color:#c00;white-space:pre-wrap">⚠️ 初始化出错：\n' + String(msg) + '</div>';
}
window.addEventListener('error', (e) => showFatal(e.message));
window.addEventListener('unhandledrejection', (e) => showFatal((e.reason && e.reason.message) || e.reason));

function bindNav() {
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (!b) return;
    $$('.nav-item').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    navigate(b.dataset.view);
  });
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!window.api) {
    showFatal('window.api 未注入：api.js 未正确加载，请检查 server 的静态服务。');
    return;
  }
  bindNav();
  try {
    state.settings = await window.api.getSettings();
  } catch (err) {
    console.warn('getSettings 失败：', err);
  }
  navigate('overview');
}

function navigate(view) {
  state.lastView = view;
  $('#view-title').textContent = TITLES[view] || '';
  $('#topbar-actions').innerHTML = '';
  const v = $('#view');
  v.innerHTML = '';
  if (view === 'overview') renderOverview(v);
  else if (view === 'knowledge') renderKnowledge(v);
  else if (view === 'gongkao' || view === 'licai') renderFeedView(v, view);
  else if (view === 'screenshots') renderScreenshots(v);
  else if (view === 'settings') renderSettings(v);
}

function addAction(label, cls, fn) {
  const b = document.createElement('button');
  b.className = 'btn' + (cls ? ' ' + cls : '');
  b.textContent = label;
  b.onclick = fn;
  $('#topbar-actions').appendChild(b);
}

function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2200);
}

function fmtDate(s) {
  try {
    return new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return s; }
}

function tabBtn(label, active, onclick) {
  const b = document.createElement('button');
  b.className = 'tab' + (active ? ' active' : '');
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

// ---------- 总览 ----------
async function renderOverview(v) {
  const [k, g, l, stories, shots] = await Promise.all([
    window.api.getFeed('knowledge'), window.api.getFeed('gongkao'), window.api.getFeed('licai'),
    window.api.getStories(), window.api.getScreenshots(),
  ]);
  const unread = (a) => a.filter((x) => !x.read).length;
  const counts = { knowledge: unread(k), gongkao: unread(g), licai: unread(l), screenshots: shots.length };
  const modules = [
    { key: 'knowledge', name: '知识流', desc: '每日新知 + 知识卡片' },
    { key: 'gongkao', name: '公考·政治', desc: '常识 / 政治理论' },
    { key: 'licai', name: '理财·经济', desc: '热点 / 经济事件' },
    { key: 'screenshots', name: '随手记', desc: '图片收集 + OCR' },
  ];
  const grid = document.createElement('div');
  grid.className = 'grid cols-4';
  modules.forEach((m) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.cursor = 'pointer';
    const h = document.createElement('h3');
    h.textContent = m.name;
    const d = document.createElement('div');
    d.className = 'meta';
    d.textContent = m.desc;
    const n = document.createElement('div');
    n.style.marginTop = '10px';
    n.style.fontSize = '13px';
    n.textContent = m.key === 'screenshots' ? '已收集 ' + counts[m.key] + ' 张' : '未读 ' + counts[m.key];
    c.append(h, d, n);
    c.onclick = () => {
      $$('.nav-item').forEach((x) => x.classList.remove('active'));
      const nav = $(`.nav-item[data-view="${m.key}"]`);
      if (nav) nav.classList.add('active');
      navigate(m.key);
    };
    grid.appendChild(c);
  });
  const h2 = document.createElement('h3');
  h2.textContent = '快捷入口';
  h2.style.margin = '24px 0 12px';
  v.append(h2, grid);

  const goal = document.createElement('div');
  goal.className = 'card';
  goal.style.marginTop = '24px';
  const gh = document.createElement('h3');
  gh.textContent = '今日目标';
  const gp = document.createElement('p');
  gp.className = 'meta';
  gp.textContent = '每天刷一条「每日新知」，替代刷短视频的 10 分钟。';
  goal.append(gh, gp);
  v.append(goal);
}

// ---------- 知识流（两个子模块） ----------
async function renderKnowledge(v) {
  $('#topbar-actions').innerHTML = '';
  v.innerHTML = '';
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const t1 = tabBtn('每日新知', state.knowledgeTab === 'stories', () => { state.knowledgeTab = 'stories'; renderKnowledge(v); });
  const t2 = tabBtn('知识卡片', state.knowledgeTab === 'knowledge', () => { state.knowledgeTab = 'knowledge'; renderKnowledge(v); });
  tabs.append(t1, t2);
  v.append(tabs);

  if (state.knowledgeTab === 'stories') {
    addAction('生成今日新知', 'primary', generateToday);
    await renderStories(v);
  } else {
    addAction('刷新', '', () => refreshFeed('knowledge'));
    await renderFeedList(v, 'knowledge');
  }
}

async function renderStories(v) {
  const stories = await window.api.getStories();
  if (!stories.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = '还没有生成。点右上角「生成今日新知」让 AI 讲一个冷门原则的故事。';
    v.append(e);
    return;
  }
  stories.forEach((s) => {
    const c = document.createElement('div');
    c.className = 'card';
    c.style.marginBottom = '16px';
    const h = document.createElement('h3');
    h.textContent = s.date + ' · ' + s.name;
    const p = document.createElement('div');
    p.className = 'story markdown';
    p.innerHTML = typeof marked !== 'undefined' ? marked.parse(s.content) : escapeHtml(s.content).replace(/\n/g, '<br>');
    c.append(h, p);
    v.append(c);
  });
}

async function generateToday() {
  const b = $('#topbar-actions .btn');
  if (b) b.disabled = true;
  toast('正在生成今日新知…');
  try {
    const s = await window.api.generateStory();
    toast('已生成：' + s.name);
    await renderKnowledge($('#view'));
  } catch (err) {
    toast('生成失败：' + err.message);
  }
}

// ---------- RSS 卡片流 ----------
async function renderFeedView(v, module) {
  $('#topbar-actions').innerHTML = '';
  addAction('刷新', '', () => refreshFeed(module));
  await renderFeedList(v, module);
}

async function renderFeedList(v, module) {
  let items = state.feeds[module];
  if (!items) { items = await window.api.getFeed(module); state.feeds[module] = items; }
  if (!items.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = '暂无内容。点「刷新」拉取（首次需联网）。';
    v.append(e);
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'grid';
  items.forEach((it) => {
    const c = document.createElement('div');
    c.className = 'feed-item' + (it.read ? '' : ' unread');
    const h = document.createElement('h3');
    h.textContent = it.title;
    const sum = document.createElement('div');
    sum.className = 'summary';
    sum.textContent = it.summary || '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const src = document.createElement('span');
    src.textContent = it.source || '';
    const dt = document.createElement('span');
    dt.textContent = fmtDate(it.date);
    meta.append(src, dt);
    c.append(h, sum, meta);
    c.onclick = () => {
      c.classList.remove('unread');
      it.read = true;
      window.api.markRead(module, it.id).catch(() => {});
      openArticle(it);
    };
    grid.appendChild(c);
  });
  v.append(grid);
}

async function openArticle(it) {
  const v = $('#view');
  v.innerHTML = '';
  $('#topbar-actions').innerHTML = '';
  const loading = document.createElement('div');
  loading.className = 'empty';
  loading.textContent = '正在拉取原文…';
  v.append(loading);
  try {
    const art = await window.api.fetchArticle(it.link);
    renderArticle(v, art);
  } catch (err) {
    // 拉取原文失败：降级用 RSS 自带正文/摘要
    renderArticle(v, {
      title: it.title,
      url: it.link,
      content: (it.content && it.content.trim().length > 30)
        ? resolveRssContent(it.content)
        : '',
      summary: it.summary || '',
      fromRss: true,
    });
  }
}

// 把 RSS 自带的 HTML 摘要清洗一下再渲染（去掉 script/style 等噪音）
function resolveRssContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(\w+)[^>]*>/g, (m, tag) => {
      const allowed = new Set(['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'div', 'span']);
      return allowed.has(tag.toLowerCase()) ? `<${tag.toLowerCase()}>` : '';
    })
    .replace(/<\/\w+[^>]*>/g, (m) => m.toLowerCase());
}

function renderArticle(v, art) {
  v.innerHTML = '';
  const top = document.createElement('div');
  top.className = 'article-top';
  const back = document.createElement('button');
  back.className = 'btn back-btn';
  back.textContent = '← 返回';
  back.onclick = () => navigate(state.lastView || 'knowledge');
  const open = document.createElement('button');
  open.className = 'btn';
  open.textContent = '在浏览器打开';
  open.onclick = () => window.api.openExternal(art.url);
  top.append(back, open);
  const title = document.createElement('h2');
  title.className = 'article-title';
  title.textContent = art.title || '无标题';
  const content = document.createElement('div');
  content.className = 'article-content';
  if (art.content && art.content.trim()) {
    content.innerHTML = art.content;
  } else if (art.summary) {
    const p = document.createElement('p');
    p.textContent = art.summary;
    content.append(p);
  }
  v.append(top, title, content);
  if (art.fromRss) {
    const note = document.createElement('div');
    note.className = 'rss-note';
    note.textContent = '（原文页面拉取失败，以下为订阅源自带摘要）';
    v.append(note);
  }
}

async function refreshFeed(module) {
  toast('正在拉取…');
  try {
    const items = await window.api.refreshFeed(module);
    state.feeds[module] = items;
    navigate(module);
    toast('已拉取 ' + items.length + ' 条');
  } catch (err) {
    toast('拉取失败：' + err.message);
  }
}

// ---------- 随手记 ----------
async function renderScreenshots(v) {
  $('#topbar-actions').innerHTML = '';
  addAction('导入截图', 'primary', importShot);
  addAction('记文字', '', addTextShot);
  const search = document.createElement('input');
  search.className = 'search-box';
  search.placeholder = '搜索标签或图中文字…';
  v.append(search);

  const noteBox = document.createElement('div');
  noteBox.className = 'note-box';
  noteBox.style.display = 'none';
  const noteTa = document.createElement('textarea');
  noteTa.placeholder = '随手记一段文字…';
  noteTa.style.minHeight = '80px';
  const noteTags = document.createElement('input');
  noteTags.placeholder = '标签，逗号分隔';
  const noteSave = document.createElement('button');
  noteSave.className = 'btn primary';
  noteSave.textContent = '保存';
  noteSave.onclick = async () => {
    const text = noteTa.value.trim();
    if (!text) return;
    const tags = noteTags.value.split(',').map((x) => x.trim()).filter(Boolean);
    await window.api.addTextNote(text, tags);
    noteTa.value = '';
    noteTags.value = '';
    noteBox.style.display = 'none';
    toast('已保存文字笔记');
    await renderScreenshots($('#view'));
  };
  noteBox.append(noteTa, noteTags, noteSave);
  v.append(noteBox);

  let shots = await window.api.getScreenshots();
  state.screenshots = shots;
  const grid = document.createElement('div');
  grid.className = 'shot-grid';
  v.append(grid);

  const draw = (list) => {
    grid.innerHTML = '';
    if (!list.length) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = '还没有记录。点「导入截图」或「记文字」收集随手信息。';
      grid.append(e);
      return;
    }
    list.forEach((s) => grid.append(shotCard(s)));
  };
  draw(shots);

  search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    if (!q) return draw(shots);
    draw(shots.filter((s) =>
      (s.tags || []).join(' ').toLowerCase().includes(q) ||
      (s.ocrText || '').toLowerCase().includes(q) ||
      (s.content || '').toLowerCase().includes(q)));
  };
}

async function addTextShot() {
  const box = $('.note-box');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
}

function shotCard(s) {
  const c = document.createElement('div');
  c.className = 'shot-card';
  const body = document.createElement('div');
  body.className = 'body';

  if (s.type === 'text') {
    const content = document.createElement('div');
    content.className = 'note-content';
    content.textContent = s.content || '';
    body.append(content);
  } else {
    const img = document.createElement('img');
    img.src = '/' + s.relPath;
    img.alt = s.name;
    body.append(img);
  }

  const tags = document.createElement('input');
  tags.className = 'tags';
  tags.placeholder = '标签，逗号分隔';
  tags.value = (s.tags || []).join(', ');
  tags.onchange = async () => {
    const t = tags.value.split(',').map((x) => x.trim()).filter(Boolean);
    await window.api.updateScreenshot(s.id, { tags: t });
    s.tags = t;
    toast('已保存标签');
  };
  body.append(tags);
  c.append(body);
  return c;
}

async function importShot() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    toast('上传并识别中…');
    try {
      await window.api.uploadImage(file);
      toast('已导入并识别文字');
      await renderScreenshots($('#view'));
    } catch (e) {
      toast('失败：' + e.message);
    }
  };
  input.click();
}

// ---------- 设置 ----------
async function renderSettings(v) {
  const s = state.settings;
  const wrap = document.createElement('div');

  const rows = [
    { key: 'aiBaseURL', label: 'AI 接口地址', hint: '默认 DeepSeek 兼容 OpenAI 格式，如 https://api.deepseek.com/v1' },
    { key: 'aiApiKey', label: 'API Key', type: 'password', hint: '不填则「每日新知」不可用；其他模块不受影响' },
    { key: 'aiModel', label: '模型名', hint: '如 deepseek-chat' },
    { key: 'pullInterval', label: '自动拉取间隔（分钟）', type: 'number', hint: '打开应用时也会拉取一次' },
  ];
  rows.forEach((r) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    const lab = document.createElement('label');
    lab.textContent = r.label;
    const inp = document.createElement('input');
    inp.dataset.key = r.key;
    inp.value = s[r.key] ?? '';
    if (r.type) inp.type = r.type;
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = r.hint || '';
    row.append(lab, inp, hint);
    wrap.append(row);
  });

  const pr = document.createElement('div');
  pr.className = 'form-row';
  const pl = document.createElement('label');
  pl.textContent = '每日新知提示词';
  const ta = document.createElement('textarea');
  ta.dataset.key = 'dailyPrompt';
  ta.value = s.dailyPrompt || '';
  pr.append(pl, ta);
  wrap.append(pr);

  const sr = document.createElement('div');
  sr.className = 'form-row';
  const sl = document.createElement('label');
  sl.textContent = 'RSS 源（每行一个，留空用默认；用 # 模块名 分组）';
  const ta2 = document.createElement('textarea');
  ta2.dataset.key = 'sources';
  ta2.style.minHeight = '120px';
  const cur = s.sources || {};
  ta2.value = ['knowledge', 'gongkao', 'licai']
    .map((m) => '# ' + m + '\n' + (cur[m] || []).join('\n'))
    .join('\n\n');
  sr.append(sl, ta2);
  wrap.append(sr);

  const save = document.createElement('button');
  save.className = 'btn primary';
  save.textContent = '保存设置';
  save.onclick = async () => {
    wrap.querySelectorAll('[data-key]').forEach((inp) => {
      if (inp.dataset.key === 'sources') s.sources = parseSources(inp.value);
      else s[inp.dataset.key] = inp.value;
    });
    s.pullInterval = Number(s.pullInterval) || 60;
    await window.api.saveSettings(s);
    state.settings = s;
    toast('设置已保存');
  };
  wrap.append(save);
  v.append(wrap);
}

function parseSources(text) {
  const out = {};
  let cur = null;
  text.split('\n').forEach((line) => {
    line = line.trim();
    if (!line) return;
    const m = line.match(/^#\s*(\w+)/);
    if (m) { cur = m[1]; out[cur] = []; return; }
    if (line.startsWith('#')) return;
    if (cur && /^https?:\/\//.test(line)) out[cur].push(line);
  });
  return out;
}
