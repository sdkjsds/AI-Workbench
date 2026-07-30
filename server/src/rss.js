const RssParser = require('rss-parser');
const parser = new RssParser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Zhiliu/0.1)' },
});

const DEFAULT_SOURCE_MAP = {
  knowledge: [
    'https://sspai.com/feed',
    'https://www.36kr.com/feed',
    'https://www.qbitai.com/feed',
    'https://www.ruanyifeng.com/blog/atom.xml',
    'https://www.ifanr.com/feed',
  ],
  gongkao: [
    // 中新网即时新闻：实时时政综合（实测最新为当天），解决原源停更到 22 年的问题
    'https://www.chinanews.com.cn/rss/scroll-news.xml',
    // 人民网时政频道：内容权威、有正文、链接可打开（偶有滞后，作为补充）
    'http://www.people.com.cn/rss/politics.xml',
  ],
  licai: [
    // 36氪：实时、含正文、链接可直接打开
    'https://www.36kr.com/feed',
    // 钛媒体：实时、含正文、链接可直接打开（科技商业视角）
    'https://www.tmtpost.com/rss',
  ],
  dressing: [
    'https://www.vogue.com/feed',
    'https://www.elle.com/rss/all.xml',
    'https://www.gq.com/feed',
    'https://www.harpersbazaar.com/rss/all.xml',
    'https://www.whowhatwear.com/feed',
  ],
};

function defaultSources(module) {
  return DEFAULT_SOURCE_MAP[module] || [];
}

async function fetchModule(module, sources) {
  const results = [];
  const seen = new Set();
  await Promise.all(sources.map(async (url) => {
    try {
      const feed = await parser.parseURL(url);
      (feed.items || []).slice(0, 10).forEach((it) => {
        const link = it.link || '';
        if (!link || seen.has(link)) return;
        seen.add(link);
        const summaryRaw = it.contentSnippet || it.content || '';
        const fullContent = it['content:encoded'] || it.content || '';
        results.push({
          id: link,
          module,
          title: it.title || '(无标题)',
          summary: summaryRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 300),
          content: fullContent || '',
          link,
          source: feed.title || url,
          date: it.isoDate || it.pubDate || new Date().toISOString(),
          read: false,
          saved: false,
        });
      });
    } catch (e) {
      console.warn('RSS fetch failed:', url, e.message);
    }
  }));
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  return results.slice(0, 10);
}

module.exports = { defaultSources, fetchModule };
