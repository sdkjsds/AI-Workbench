const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { DEFAULT_PROMPT } = require('./prompt');

// 数据目录：可用环境变量 DATA_DIR 覆盖（部署到服务器时指向持久化磁盘）
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
function dataDir() { return DATA_DIR; }
function feedsDir() { return path.join(DATA_DIR, 'feeds'); }
function imgDir() { return path.join(DATA_DIR, 'images'); }
function storiesFile() { return path.join(DATA_DIR, 'stories.json'); }
function screenshotsFile() { return path.join(DATA_DIR, 'screenshots.json'); }
function settingsFile() { return path.join(DATA_DIR, 'settings.json'); }

function defaultSettings() {
  return {
    aiBaseURL: 'https://api.deepseek.com/v1',
    aiApiKey: '',
    aiModel: 'deepseek-chat',
    dailyPrompt: DEFAULT_PROMPT,
    pullInterval: 60,
    sources: {},
  };
}

async function init() {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.mkdir(feedsDir(), { recursive: true });
  await fs.mkdir(imgDir(), { recursive: true });
  try { await fs.access(settingsFile()); }
  catch { await saveSettings(defaultSettings()); }
}

async function readJSON(file, fallback) {
  try { const t = await fs.readFile(file, 'utf8'); return JSON.parse(t); }
  catch { return fallback; }
}
async function writeJSON(file, obj) {
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

// 环境变量可覆盖 AI 相关配置（部署到 Render 等无持久盘平台时防丢）
const ENV_SETTINGS = {
  aiApiKey: 'ZHILIU_AI_API_KEY',
  aiBaseURL: 'ZHILIU_AI_BASE_URL',
  aiModel: 'ZHILIU_AI_MODEL',
  dailyPrompt: 'ZHILIU_AI_PROMPT',
};

async function getSettings() {
  const raw = await readJSON(settingsFile(), defaultSettings());
  const merged = { ...defaultSettings(), ...raw, sources: raw.sources || {} };
  const envProvided = {};
  for (const [key, envVar] of Object.entries(ENV_SETTINGS)) {
    const v = process.env[envVar];
    if (v !== undefined && v !== '') {
      merged[key] = v;
      envProvided[key] = envVar;
    }
  }
  merged._envProvided = envProvided;
  return merged;
}
async function saveSettings(s) {
  const base = defaultSettings();
  const { _envProvided, ...rest } = s;
  const merged = { ...base, ...rest, sources: rest.sources || base.sources };
  await writeJSON(settingsFile(), merged);
  return merged;
}

async function getFeed(module) { return readJSON(path.join(feedsDir(), module + '.json'), []); }
async function saveFeed(module, items) { await writeJSON(path.join(feedsDir(), module + '.json'), items); }
async function markRead(module, id) {
  const arr = await getFeed(module);
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) {
    arr[i].read = true;
    await writeJSON(path.join(feedsDir(), module + '.json'), arr);
  }
}

async function getStories() { return readJSON(storiesFile(), []); }
async function saveStory(story) {
  const arr = await getStories();
  arr.unshift(story);
  await writeJSON(storiesFile(), arr);
}

async function getScreenshots() { return readJSON(screenshotsFile(), []); }
async function addImageShot(filename, name, ocrText = '') {
  const meta = {
    id: crypto.randomBytes(8).toString('hex'),
    type: 'image',
    name: name || filename,
    filename,
    relPath: 'images/' + filename,
    tags: [],
    ocrText,
    createdAt: new Date().toISOString(),
  };
  const arr = await getScreenshots();
  arr.unshift(meta);
  await writeJSON(screenshotsFile(), arr);
  return meta;
}
async function addTextNote(content, tags = []) {
  const id = crypto.randomBytes(8).toString('hex');
  const meta = {
    id,
    type: 'text',
    name: content.slice(0, 20) || '文字笔记',
    content,
    tags,
    createdAt: new Date().toISOString(),
  };
  const arr = await getScreenshots();
  arr.unshift(meta);
  await writeJSON(screenshotsFile(), arr);
  return meta;
}

async function updateScreenshot(id, patch) {
  const arr = await getScreenshots();
  const i = arr.findIndex((s) => s.id === id);
  if (i >= 0) {
    arr[i] = { ...arr[i], ...patch };
    await writeJSON(screenshotsFile(), arr);
    return arr[i];
  }
  return null;
}

module.exports = {
  init, getSettings, saveSettings,
  getFeed, saveFeed, markRead,
  getStories, saveStory,
  getScreenshots, addImageShot, addTextNote, updateScreenshot,
  imgDir, dataDir,
};
