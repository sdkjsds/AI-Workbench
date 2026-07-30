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
    // 实测可用（2026-07-30）：ELLE 英文，含秀场/红毯/穿搭报道，实时
    'https://www.elle.com/rss/all.xml',
    // Harper's Bazaar 英文，有时装周/红毯/风格内容，实时
    'https://www.harpersbazaar.com/rss/all.xml',
    // WWD（女装日报）：时装商业 + 秀场/红毯报道，偏专业审美
    'https://wwd.com/feed/',
  ],
};

function defaultSources(module) {
  return DEFAULT_SOURCE_MAP[module] || [];
}

const LATEST_PER_SOURCE = 20; // 每个源单次最多取多少条（扩大窗口，便于累积更旧内容）

function mapItem(it, module, feedTitle, url) {
  const link = it.link || '';
  const summaryRaw = it.contentSnippet || it.content || '';
  const fullContent = it['content:encoded'] || it.content || '';
  return {
    id: link,
    module,
    title: it.title || '(无标题)',
    summary: summaryRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 300),
    content: fullContent || '',
    link,
    source: feedTitle || url,
    date: it.isoDate || it.pubDate || new Date().toISOString(),
    read: false,
    saved: false,
  };
}

// 抓取一个/多个分页，跨源跨页去重，按时间倒序返回全部（不再截断到 10 条）
async function fetchModule(module, sources, opts = {}) {
  const startPage = opts.startPage || 1;
  const pages = opts.pages || 1;
  const results = [];
  const seen = new Set();
  await Promise.all(sources.map(async (url) => {
    for (let p = startPage; p < startPage + pages; p++) {
      try {
        const u = p > 1 ? url + (url.includes('?') ? '&' : '?') + 'paged=' + p : url;
        const feed = await parser.parseURL(u);
        const title = feed.title || url;
        let added = 0;
        (feed.items || []).slice(0, LATEST_PER_SOURCE).forEach((it) => {
          const link = it.link || '';
          if (!link || seen.has(link)) return;
          seen.add(link);
          results.push(mapItem(it, module, title, url));
          added++;
        });
        // 源不支持分页时，第 2 页起内容与首页完全相同 → added=0，停止翻页避免无效请求
        if (added === 0 && p > startPage) break;
      } catch (e) {
        console.warn('RSS fetch failed:', url, 'page', p, e.message);
        break;
      }
    }
  }));
  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  return results;
}

module.exports = { defaultSources, fetchModule };
