// 前端 API 封装：统一通过 fetch 调用后端 REST 接口
// 桌面壳与手机 PWA 共用同一套接口，无需 Electron IPC

async function req(url, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 20000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) {
      let msg = '请求失败(' + r.status + ')';
      try { const j = await r.json(); if (j && j.error) msg = j.error; } catch (e) {}
      throw new Error(msg);
    }
    return r.json();
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('请求超时');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

window.api = {
  async getSettings() { return req('/api/settings'); },
  async saveSettings(s) {
    return req('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
  },
  async refreshFeed(module) {
    return req(`/api/feed/${module}/refresh`, { method: 'POST' });
  },
  async getFeed(module) { return req(`/api/feed/${module}`); },
  async markRead(module, id) {
    await req(`/api/feed/${module}/markread`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  },
  async fetchArticle(url) {
    return req('/api/article?url=' + encodeURIComponent(url));
  },
  async getStories() { return req('/api/stories'); },
  async generateStory() { return req('/api/story/generate', { method: 'POST' }); },
  async getDressingStories() { return req('/api/dressing/stories'); },
  async generateDressingInspiration() { return req('/api/dressing/generate', { method: 'POST' }); },
  async briefArticle(title, summary) {
    return req('/api/article/brief', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, summary }) });
  },
  async getScreenshots() { return req('/api/screenshots'); },
  async addTextNote(content, tags) {
    return req('/api/screenshots/text', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, tags }) });
  },
  async uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    return req('/api/screenshots/image', { method: 'POST', body: fd, timeout: 60000 });
  },
  async updateScreenshot(id, patch) {
    await req(`/api/screenshots/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
  },
  openExternal(url) { window.open(url, '_blank'); },
};
