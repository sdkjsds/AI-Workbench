// 前端 API 封装：统一通过 fetch 调用后端 REST 接口
// 桌面壳与手机 PWA 共用同一套接口，无需 Electron IPC
window.api = {
  async getSettings() {
    const r = await fetch('/api/settings');
    return r.json();
  },
  async saveSettings(s) {
    const r = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    });
    return r.json();
  },
  async refreshFeed(module) {
    const r = await fetch(`/api/feed/${module}/refresh`, { method: 'POST' });
    if (!r.ok) throw new Error((await r.json()).error || '拉取失败');
    return r.json();
  },
  async getFeed(module) {
    const r = await fetch(`/api/feed/${module}`);
    return r.json();
  },
  async markRead(module, id) {
    await fetch(`/api/feed/${module}/markread`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  },
  async fetchArticle(url) {
    const r = await fetch('/api/article?url=' + encodeURIComponent(url));
    if (!r.ok) throw new Error('拉取原文失败');
    return r.json();
  },
  async getStories() {
    const r = await fetch('/api/stories');
    return r.json();
  },
  async generateStory() {
    const r = await fetch('/api/story/generate', { method: 'POST' });
    if (!r.ok) throw new Error((await r.json()).error || '生成失败');
    return r.json();
  },
  async getDressingStories() {
    const r = await fetch('/api/dressing/stories');
    return r.json();
  },
  async generateDressingInspiration() {
    const r = await fetch('/api/dressing/generate', { method: 'POST' });
    if (!r.ok) throw new Error((await r.json()).error || '生成失败');
    return r.json();
  },
  async briefArticle(title, summary) {
    const r = await fetch('/api/article/brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, summary }),
    });
    if (!r.ok) throw new Error((await r.json()).error || '简述失败');
    return r.json();
  },
  async getScreenshots() {
    const r = await fetch('/api/screenshots');
    return r.json();
  },
  async addTextNote(content, tags) {
    const r = await fetch('/api/screenshots/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tags }),
    });
    return r.json();
  },
  async uploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const r = await fetch('/api/screenshots/image', { method: 'POST', body: fd });
    if (!r.ok) throw new Error((await r.json()).error || '上传失败');
    return r.json();
  },
  async updateScreenshot(id, patch) {
    await fetch(`/api/screenshots/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },
  openExternal(url) {
    window.open(url, '_blank');
  },
};
