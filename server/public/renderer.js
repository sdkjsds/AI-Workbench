const state = { settings: null, feeds: {}, stories: [], screenshots: [], knowledgeTab: 'stories', dressingTab: 'inspiration' };
const TITLES = { overview: '总览', knowledge: '知识流', gongkao: '公考·政治理论', licai: '理财·经济', dressing: '审美·穿搭', screenshots: '随手记', settings: '设置' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
function escapeHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showFatal(msg) {
  const v = document.getElementById('view');
  if (v) v.innerHTML = '<div class="card" style="color:#c00;white-space:pre-wrap">⚠️ 初始化出错：\n' + String(msg) + '</div>';
}
window.addEventListener('error', (e) => console.error('运行时错误:', e.message));
window.addEventListener('unhandledrejection', (e) => console.error('未处理的 Promise 拒绝:', (e.reason && e.reason.message) || e.reason));

function bindNav() {
  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (!b) return;
    $$('.nav-item').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    navigate(b.dataset.view);
    closeSidebar();
  });
  // Hamburger toggle
  const hb = document.getElementById('hamburger');
  const sc = document.getElementById('sidebarClose');
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  if (hb) hb.addEventListener('click', toggleSidebar);
  if (sc) sc.addEventListener('click', closeSidebar);
  if (ov) ov.addEventListener('click', closeSidebar);
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('show');
}
function closeSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb && sb.classList.remove('open');
  ov && ov.classList.remove('show');
}

// 移动端抽屉手势：总览页从左边缘右滑打开导航栏；导航栏左滑关闭回到总览
function bindSidebarGestures() {
  if (window.innerWidth > 768) return;
  let sx = 0, sy = 0;
  document.addEventListener('touchstart', (e) => {
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dy) > 50) return; // 纵向滚动，忽略
    const sb = document.getElementById('sidebar');
    const open = sb && sb.classList.contains('open');
    if (open) {
      // 导航栏打开时：向左滑关闭
      if (dx < -60) closeSidebar();
    } else {
      // 总览页（非文章详情）从左边缘向右滑打开
      if (!state.inArticle && sx <= 30 && dx > 60) toggleSidebar();
    }
  }, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);

async function init() {
  if (!window.api) {
    showFatal('window.api 未注入：api.js 未正确加载，请检查 server 的静态服务。');
    return;
  }
  bindNav();
  bindSidebarGestures();
  try {
    state.settings = await window.api.getSettings();
  } catch (err) {
    console.warn('getSettings 失败：', err);
  }
  navigate('overview');
}

function navigate(view) {
  state.lastView = view;
  state.inArticle = false;
  $('#view-title').textContent = TITLES[view] || '';
  $('#topbar-actions').innerHTML = '';
  const v = $('#view');
  v.innerHTML = '';
  if (view === 'overview') renderOverview(v);
  else if (view === 'knowledge') renderKnowledge(v);
  else if (view === 'gongkao' || view === 'licai') renderFeedView(v, view);
  else if (view === 'dressing') renderDressing(v);
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
  v.innerHTML = '<div class="empty">加载中…</div>';
  const safe = async (p) => { try { const r = await p; return Array.isArray(r) ? r : []; } catch (e) { console.warn('总览子项加载失败:', e.message); return []; } };
  const [k, g, l, d, stories, shots] = await Promise.all([
    safe(window.api.getFeed('knowledge')), safe(window.api.getFeed('gongkao')), safe(window.api.getFeed('licai')),
    safe(window.api.getFeed('dressing')),
    safe(window.api.getStories()), safe(window.api.getScreenshots()),
  ]);
  const unread = (a) => a.filter((x) => !x.read).length;
  const counts = { knowledge: unread(k), gongkao: unread(g), licai: unread(l), dressing: unread(d), screenshots: shots.length };
  v.innerHTML = '';
  const modules = [
    { key: 'knowledge', name: '知识流', desc: '每日新知 + 知识卡片' },
    { key: 'gongkao', name: '公考·政治', desc: '常识 / 政治理论' },
    { key: 'licai', name: '理财·经济', desc: '热点 / 经济事件' },
    { key: 'dressing', name: '审美·穿搭', desc: '审美输入 + 每日灵感' },
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

// ---------- 穿搭（每日灵感 + 卡片流） ----------
async function renderDressing(v) {
  $('#topbar-actions').innerHTML = '';
  v.innerHTML = '';
  const tabs = document.createElement('div');
  tabs.className = 'tabs';
  const t1 = tabBtn('每日灵感', state.dressingTab !== 'feed', () => { state.dressingTab = 'inspiration'; renderDressing(v); });
  const t2 = tabBtn('穿搭卡片', state.dressingTab === 'feed', () => { state.dressingTab = 'feed'; renderDressing(v); });
  tabs.append(t1, t2);
  v.append(tabs);

  if (state.dressingTab === 'feed') {
    addAction('刷新', '', () => refreshFeed('dressing'));
    await renderFeedList(v, 'dressing');
  } else {
    addAction('生成今日灵感', 'primary', generateDressingInspiration);
    await renderDressingStories(v);
  }
}

async function renderDressingStories(v) {
  const stories = await window.api.getDressingStories();
  if (!stories.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = '还没有灵感。点右上角「生成今日灵感」让 AI 给一条简短穿搭建议。';
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
    p.className = 'story';
    p.textContent = s.content;
    c.append(h, p);
    v.append(c);
  });
}

async function generateDressingInspiration() {
  const b = $('#topbar-actions .btn');
  if (b) b.disabled = true;
  toast('正在生成今日灵感…');
  try {
    const s = await window.api.generateDressingInspiration();
    toast('已生成今日灵感');
    await renderDressing($('#view'));
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
      openArticle(it, module);
    };
    grid.appendChild(c);
  });
  v.append(grid);
}

async function openArticle(it, moduleArg, direction) {
  const module = moduleArg || state.lastView;

  // 统一标记已读：无论是从列表点入还是左右滑动切入，都视为已读
  if (module && it.id && !it.read) {
    it.read = true;
    window.api.markRead(module, it.id).catch(() => {});
  }

  const items = (module && state.feeds[module]) || [];
  const idx = items.findIndex((x) => x.id === it.id || x.link === it.link);
  state.articleContext = { module, items, index: idx >= 0 ? idx : 0 };
  state.inArticle = true;

  const v = $('#view');
  v.innerHTML = '';
  $('#topbar-actions').innerHTML = '';

  // 先用 RSS 自带内容/摘要做首屏，立刻可见，消除空白等待
  const quick = (it.content && it.content.trim().length > 30)
    ? resolveRssContent(it.content)
    : (it.summary ? '<p>' + escapeHtml(it.summary) + '</p>' : '');
  if (quick) {
    renderArticle(v, { title: it.title, url: it.link, content: quick, summary: it.summary || '' });
  } else {
    const loading = document.createElement('div');
    loading.className = 'empty';
    loading.textContent = '正在拉取原文…';
    v.append(loading);
  }

  // 滑动切换时：内容滑入动画（旧内容已在 slideTo 中先滑出）
  if (direction) {
    v.style.overflowX = 'hidden';
    v.style.transition = 'none';
    v.style.opacity = '0';
    v.style.transform = direction === 'left' ? 'translateX(35%)' : 'translateX(-35%)';
    void v.offsetWidth; // 强制回流，确保起点立即生效
    requestAnimationFrame(() => {
      v.style.transition = 'transform .28s ease, opacity .28s ease';
      v.style.transform = 'translateX(0)';
      v.style.opacity = '1';
      setTimeout(() => {
        v.style.transition = '';
        v.style.transform = '';
        v.style.opacity = '';
        v.style.overflowX = '';
      }, 320);
    });
  }

  // 后台异步拉取原文，成功后再替换
  try {
    const art = await window.api.fetchArticle(it.link);
    renderArticle(v, { ...art, url: it.link });
  } catch (err) {
    if (!quick) {
      renderArticle(v, { title: it.title, url: it.link, content: '', summary: it.summary || '', fromRss: true });
    } else {
      const note = document.createElement('div');
      note.className = 'rss-note';
      note.textContent = '（原文页面拉取失败，以上为订阅源自带摘要）';
      v.append(note);
    }
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

  if (state.lastView === 'dressing') {
    const briefBtn = document.createElement('button');
    briefBtn.className = 'btn';
    briefBtn.textContent = 'AI 简述';
    briefBtn.onclick = async () => {
      briefBtn.disabled = true;
      briefBtn.textContent = '生成中…';
      try {
        const r = await window.api.briefArticle(art.title, art.summary || '');
        const box = document.createElement('div');
        box.className = 'brief-box';
        box.style.margin = '12px 0';
        box.style.padding = '12px 14px';
        box.style.background = 'var(--accent-soft)';
        box.style.borderRadius = '8px';
        box.style.lineHeight = '1.7';
        box.textContent = '🤖 ' + r.brief;
        v.insertBefore(box, title);
      } catch (e) {
        toast('简述失败：' + e.message);
      } finally {
        briefBtn.disabled = false;
        briefBtn.textContent = 'AI 简述';
      }
    };
    top.append(briefBtn);
  }
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

  // 手机端支持左右滑动切换上/下一条（监听器只挂一次，内部实时读当前 ctx）
  if (window.innerWidth <= 768) {
    attachArticleSwipe(v);
  }
}

// 滑动监听只挂在 #view 上一次，handler 内部实时读取 state.articleContext，
// 避免重复打开文章时旧监听器累积导致跨模块误跳。
function attachArticleSwipe(el) {
  if (el._swipeAttached) return;
  el._swipeAttached = true;
  let startX = 0, startY = 0, tracking = false;
  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!tracking) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - startX;
    const dy = y - startY;
    // 一旦判定为垂直滚动，取消本次 swipe；水平滑动继续跟踪
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      tracking = false;
    }
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    const ctx = state.articleContext;
    if (!state.inArticle || !ctx || !ctx.items || ctx.items.length <= 1) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const dx = endX - startX;
    const dy = endY - startY;
    // 以水平滑动为主且距离足够才触发
    if (Math.abs(dx) < Math.abs(dy) || Math.abs(dx) < 40) return;
    if (dx < 0) {
      // 左滑 → 下一条
      if (ctx.index >= ctx.items.length - 1) { toast('这是最后一条'); return; }
      ctx.index++;
      slideTo(ctx.items[ctx.index], ctx.module, 'left');
    } else {
      // 右滑 → 上一条
      if (ctx.index <= 0) { toast('这是第一条'); return; }
      ctx.index--;
      slideTo(ctx.items[ctx.index], ctx.module, 'right');
    }
  }, { passive: true });
}

// 滑动切换：先让当前文章滑出，再渲染下一篇并从反方向滑入，形成平滑过渡
function slideTo(it, module, dir) {
  const v = $('#view');
  v.style.overflowX = 'hidden';
  v.style.transition = 'transform .25s ease, opacity .25s ease';
  v.style.transform = dir === 'left' ? 'translateX(-35%)' : 'translateX(35%)';
  v.style.opacity = '0';
  setTimeout(() => {
    openArticle(it, module, dir);
  }, 250);
}

async function refreshFeed(module) {
  toast('正在拉取…');
  try {
    const oldItems = state.feeds[module] || [];
    const oldIds = new Set(oldItems.map((it) => it.id || it.link));
    const data = await window.api.refreshFeed(module);
    const items = data.items || [];
    state.feeds[module] = items;
    navigate(module);
    window.scrollTo(0, 0);
    const newCount = (data.newCount != null)
      ? data.newCount
      : items.filter((it) => !oldIds.has(it.id || it.link)).length;
    if (items.length === 0) {
      toast('未拉取到内容，请检查网络或 RSS 源');
    } else if (newCount > 0) {
      toast('已更新：新增 ' + newCount + ' 条（共 ' + items.length + ' 条）');
    } else {
      toast('已拉到最早的内容（共 ' + items.length + ' 条）');
    }
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
    if (s._envProvided && s._envProvided[r.key]) {
      inp.disabled = true;
      const envNote = document.createElement('div');
      envNote.className = 'hint';
      envNote.style.color = '#2a7';
      envNote.textContent = '✓ 已由服务器环境变量配置（' + s._envProvided[r.key] + '），无需填写';
      row.append(envNote);
    }
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
  if (s._envProvided && s._envProvided.dailyPrompt) {
    ta.disabled = true;
    const envNote = document.createElement('div');
    envNote.className = 'hint';
    envNote.style.color = '#2a7';
    envNote.textContent = '✓ 已由服务器环境变量配置（' + s._envProvided.dailyPrompt + '），无需填写';
    pr.append(envNote);
  }
  wrap.append(pr);

  const sr = document.createElement('div');
  sr.className = 'form-row';
  const sl = document.createElement('label');
  sl.textContent = 'RSS 源（每行一个，留空用默认；用 # 模块名 分组）';
  const ta2 = document.createElement('textarea');
  ta2.dataset.key = 'sources';
  ta2.style.minHeight = '120px';
  const cur = s.sources || {};
  ta2.value = ['knowledge', 'gongkao', 'licai', 'dressing']
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

// ---------- 安卓硬件返回键 ----------
// 层级：文章详情 → 小板块列表 → 总览 →（在总览连按两次）退出应用
// 仅 APK 内（window.Capacitor 存在）生效；PWA / 桌面忽略，交给浏览器自身返回。
function setupAndroidBack() {
  const cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (!cap) return;
  let lastBack = 0;
  cap.addListener('backButton', () => {
    const now = Date.now();
    if (state.inArticle) {
      // 文章详情：返回到所属小板块列表
      navigate(state.lastView || 'knowledge');
      lastBack = 0;
      return;
    }
    if (state.lastView && state.lastView !== 'overview') {
      // 小板块 / 其它界面：返回总览
      navigate('overview');
      lastBack = 0;
      return;
    }
    // 已在总览：1.8 秒内连按两次才退出，避免误触
    if (now - lastBack < 1800) {
      cap.exitApp();
    } else {
      lastBack = now;
      toast('再按一次返回键退出应用');
    }
  });
}

// Capacitor 桥通常在页面加载时注入；若尚未就绪，等 load 后再尝试
if (window.Capacitor) {
  setupAndroidBack();
} else {
  window.addEventListener('load', () => setTimeout(setupAndroidBack, 200));
}
