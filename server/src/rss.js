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
    'http://www.people.com.cn/rss/politics.xml',
    'https://www.xinhuanet.com/politics/news_politics.xml',
    'https://www.chinanews.com.cn/rss/scroll-news.xml',
  ],
  licai: [
    'https://www.xinhuanet.com/fortune/news_finance.xml',
    'http://www.people.com.cn/rss/finance.xml',
    'https://www.tmtpost.com/rss',
    'https://www.36kr.com/feed',
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
