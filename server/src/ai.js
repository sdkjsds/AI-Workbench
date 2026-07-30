const storage = require('./storage');
const { DEFAULT_PROMPT, DRESSING_INSPIRATION_PROMPT, ARTICLE_BRIEF_PROMPT } = require('./prompt');

function todayStr() { return new Date().toISOString().slice(0, 10); }
function slug(s) { return (s || '').replace(/[^\w一-龥]+/g, '-').slice(0, 40); }
function extractName(text) {
  const m = text.match(/名称[:：]\s*(.+)/);
  if (m) return m[1].trim().replace(/[。「」"']/g, '');
  return null;
}

async function generateDailyStory() {
  const settings = await storage.getSettings();
  if (!settings.aiApiKey) throw new Error('尚未配置 API Key，请到「设置」填写。');

  const dateStr = todayStr();
  const stories = await storage.getStories();
  const existing = stories.find((s) => s.date === dateStr);
  if (existing) return existing; // 今日已生成，直接返回，不重复消耗额度

  const prompt = settings.dailyPrompt || DEFAULT_PROMPT;
  const baseURL = (settings.aiBaseURL || 'https://api.deepseek.com/v1').replace(/\/$/, '');

  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel || 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.9,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`AI 调用失败 (${resp.status}): ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const name = extractName(content) || ('知识点-' + dateStr);
  const story = {
    id: `${dateStr}-${slug(name)}`,
    date: dateStr,
    name,
    content,
    createdAt: new Date().toISOString(),
  };
  await storage.saveStory(story);
  return story;
}

async function generateDressingInspiration() {
  const settings = await storage.getSettings();
  if (!settings.aiApiKey) throw new Error('尚未配置 API Key，请到「设置」填写。');

  const dateStr = todayStr();
  const stories = await storage.getDressingStories();
  const existing = stories.find((s) => s.date === dateStr);
  if (existing) return existing; // 今日已生成，直接返回，不重复消耗额度

  const baseURL = (settings.aiBaseURL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel || 'deepseek-chat',
      messages: [{ role: 'user', content: DRESSING_INSPIRATION_PROMPT }],
      temperature: 0.9,
      max_tokens: 200,
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`AI 调用失败 (${resp.status}): ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content || '';
  const story = {
    id: `${dateStr}-inspiration`,
    date: dateStr,
    name: '今日穿搭灵感',
    content,
    createdAt: new Date().toISOString(),
  };
  await storage.saveDressingStory(story);
  return story;
}

async function briefArticle(title, summary) {
  const settings = await storage.getSettings();
  if (!settings.aiApiKey) throw new Error('尚未配置 API Key，请到「设置」填写。');
  const baseURL = (settings.aiBaseURL || 'https://api.deepseek.com/v1').replace(/\/$/, '');
  const userContent = `${ARTICLE_BRIEF_PROMPT}\n\n标题：${title}\n摘要：${(summary || '').slice(0, 500)}`;
  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.aiApiKey}`,
    },
    body: JSON.stringify({
      model: settings.aiModel || 'deepseek-chat',
      messages: [{ role: 'user', content: userContent }],
      temperature: 0.7,
      max_tokens: 120,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`AI 调用失败 (${resp.status}): ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

module.exports = { generateDailyStory, generateDressingInspiration, briefArticle };
