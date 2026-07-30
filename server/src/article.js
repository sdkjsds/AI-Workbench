const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.baidu.com/',
  'Connection': 'keep-alive',
};

async function fetchText(url) {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10000);
    try {
      const res = await fetch(url, { headers: HEADERS, redirect: 'follow', signal: ctrl.signal });
      if (!res.ok) throw new Error(`拉取失败 (${res.status})`);
      return await res.text();
    } catch (e) {
      lastErr = e;
      if (e.name === 'AbortError') break; // 超时不再重试，直接失败
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

async function fetchArticle(url) {
  const html = await fetchText(url);
  return cleanArticle(html, url);
}

function cleanArticle(html, url) {
  // 优先用 Firefox 同款 Readability 引擎提取正文
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (article && article.content && article.content.length > 200) {
      return {
        title: article.title || extractTitle(html),
        content: resolveRelativeUrls(article.content, url),
        url,
        byline: article.byline || '',
        excerpt: article.excerpt || '',
      };
    }
  } catch (e) {
    // 失败时降级到简单提取
  }

  // 降级方案
  let title = extractTitle(html);
  let body = html.replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  let content = '';
  const articleMatch = body.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const mainMatch = body.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  if (articleMatch) content = articleMatch[1];
  else if (mainMatch) content = mainMatch[1];
  else {
    const bodyMatch = body.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : body;
  }

  content = content
    .replace(/<(\w+)[^>]*>/g, (m, tag) => {
      const allowed = new Set(['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code', 'div', 'span']);
      if (!allowed.has(tag.toLowerCase())) return '';
      return `<${tag.toLowerCase()}>`;
    })
    .replace(/<\/\w+[^>]*>/g, (m) => m.toLowerCase())
    .replace(/\n\s*\n/g, '\n');

  return { title, content, url };
}

function extractTitle(html) {
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) title = titleMatch[1].replace(/\s+/g, ' ').trim();
  return title;
}

function resolveRelativeUrls(content, baseUrl) {
  try {
    const dom = new JSDOM(content, { url: baseUrl });
    const doc = dom.window.document;
    doc.querySelectorAll('img[src]').forEach((img) => {
      try { img.src = new URL(img.getAttribute('src'), baseUrl).href; } catch (e) {}
    });
    doc.querySelectorAll('a[href]').forEach((a) => {
      try { a.href = new URL(a.getAttribute('href'), baseUrl).href; } catch (e) {}
    });
    return doc.body.innerHTML;
  } catch (e) {
    return content;
  }
}

module.exports = { fetchArticle };
