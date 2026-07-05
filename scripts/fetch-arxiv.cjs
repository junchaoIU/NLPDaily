/**
 * 抓取 arxiv cs.CL 当天文章
 * 每天保存为独立文件 data/articles-YYYY-MM-DD.json
 * 用法: node scripts/fetch-arxiv.js
 */

const fs = require('fs');
const path = require('path');

// 获取当天日期字符串 YYYY-MM-DD
function getTodayDateString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当天日期范围 (UTC) 用于 arxiv 查询
function getTodayDateRange() {
  const date = getTodayDateString();
  return {
    start: `${date.replace(/-/g, '')}000000`,
    end: `${date.replace(/-/g, '')}235959`,
  };
}

// 构建 arxiv API 查询 URL（当天文章，最多 2000 篇）
function buildArxivUrl() {
  const { start, end } = getTodayDateRange();
  const query = `search_query=cat:cs.CL+AND+submittedDate:[${start}+TO+${end}]&sortBy=submittedDate&sortOrder=descending&max_results=2000`;
  return `http://export.arxiv.org/api/query?${query}`;
}

const ARXIV_API_URL = buildArxivUrl();

// 并发控制
const CONCURRENCY = 5;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 解析 arxiv Atom XML 响应
 */
function parseAtomXml(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    const idMatch = entry.match(/<id>([^<]+)<\/id>/);
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
    const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
    const commentMatch = entry.match(/<arxiv:comment>([^<]+)<\/arxiv:comment>/);

    // 提取分类
    const categories = [];
    const catRegex = /<category term="([^"]+)"/g;
    let catMatch;
    while ((catMatch = catRegex.exec(entry)) !== null) {
      categories.push(catMatch[1]);
    }

    // 提取作者
    const authors = [];
    const authorRegex = /<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g;
    let authorMatch;
    while ((authorMatch = authorRegex.exec(entry)) !== null) {
      authors.push({ name: authorMatch[1], affiliation: '' });
    }

    const id = idMatch ? idMatch[1].split('/').pop() : '';

    entries.push({
      id,
      title: titleMatch ? titleMatch[1].trim().replace(/\n\s*/g, ' ') : '',
      authors,
      abstract: summaryMatch ? summaryMatch[1].trim().replace(/\n\s*/g, ' ') : '',
      categories: [...new Set(categories)],
      published: publishedMatch ? publishedMatch[1] : '',
      updated: updatedMatch ? updatedMatch[1] : '',
      absUrl: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
      comment: commentMatch ? commentMatch[1].trim() : undefined,
    });
  }

  return entries;
}

/**
 * 抓取单篇文章的摘要页，解析作者单位
 */
async function fetchAffiliations(article) {
  try {
    const url = `https://arxiv.org/abs/${article.id}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AcademicAssistant/1.0 (research tool; contact via GitHub)',
      },
    });

    if (!response.ok) {
      console.warn(`获取 ${article.id} 失败: ${response.status}`);
      return article;
    }

    const html = await response.text();

    // 解析作者单位 - 从 HTML 中提取
    const affiliations = [];

    // 模式1: <span class="affiliation">...</span>
    const affRegex1 = /<span[^>]*class="[^"]*affiliation[^"]*"[^>]*>([^<]+)<\/span>/gi;
    let affMatch;
    while ((affMatch = affRegex1.exec(html)) !== null) {
      affiliations.push(affMatch[1].trim());
    }

    // 模式2: 在作者名后的括号中
    const affRegex2 = /\(([^)]+)\)/g;
    while ((affMatch = affRegex2.exec(html)) !== null) {
      const text = affMatch[1].trim();
      if (text.length > 3 && text.length < 200 && !text.includes('http')) {
        affiliations.push(text);
      }
    }

    // 模式3: 从 <div class="dateline"> 附近提取
    const datelineMatch = html.match(/<div[^>]*class="[^"]*dateline[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (datelineMatch) {
      const affRegex3 = />([^<]+)</g;
      let m;
      while ((m = affRegex3.exec(datelineMatch[1])) !== null) {
        const text = m[1].trim();
        if (text.length > 3 && text.length < 200) {
          affiliations.push(text);
        }
      }
    }

    // 去重并限制数量
    const uniqueAffiliations = [...new Set(affiliations)].slice(0, article.authors.length);

    // 将单位分配给作者
    const updatedAuthors = article.authors.map((author, idx) => ({
      ...author,
      affiliation: uniqueAffiliations[idx] || uniqueAffiliations[0] || '',
    }));

    return {
      ...article,
      authors: updatedAuthors,
    };
  } catch (err) {
    console.warn(`抓取 ${article.id} 时出错:`, err.message);
    return article;
  }
}

/**
 * 并发执行任务
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (tasks.length >= concurrency) {
      const e = p.then(() => {});
      executing.push(e);
      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

/**
 * 获取所有可用的日期列表
 */
function getAvailableDates(dataDir) {
  if (!fs.existsSync(dataDir)) return [];
  
  const files = fs.readdirSync(dataDir);
  const dates = files
    .filter(f => f.startsWith('articles-') && f.endsWith('.json'))
    .map(f => f.replace('articles-', '').replace('.json', ''))
    .sort((a, b) => b.localeCompare(a)); // 降序，最新的在前
  
  return dates;
}

/**
 * 清理超过 30 天的旧文件
 */
function cleanupOldFiles(dataDir) {
  const files = fs.readdirSync(dataDir);
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  files.forEach(file => {
    if (!file.startsWith('articles-') || !file.endsWith('.json')) return;
    
    const filePath = path.join(dataDir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtime < thirtyDaysAgo) {
      fs.unlinkSync(filePath);
      console.log(`已清理旧文件: ${file}`);
    }
  });
}

async function main() {
  console.log('开始抓取 arxiv cs.CL 文章...');

  try {
    // 1. 获取文章列表
    console.log('请求 arxiv API...');
    console.log('URL:', ARXIV_API_URL);
    const response = await fetch(ARXIV_API_URL, {
      headers: {
        'User-Agent': 'AcademicAssistant/1.0 (research tool; contact via GitHub)',
      },
    });

    if (!response.ok) {
      throw new Error(`arxiv API 返回 ${response.status}`);
    }

    const xml = await response.text();
    let articles = parseAtomXml(xml);
    console.log(`获取到 ${articles.length} 篇文章`);

    // 2. 抓取每篇文章的作者单位
    console.log('抓取作者单位信息...');
    const tasks = articles.map((article) => () => fetchAffiliations(article));
    articles = await runWithConcurrency(tasks, CONCURRENCY);

    // 3. 保存数据到按日期命名的文件
    const dataDir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const today = getTodayDateString();
    const data = {
      articles,
      fetchedAt: new Date().toISOString(),
      count: articles.length,
      date: today,
    };

    // 保存当天数据
    const outputPath = path.join(dataDir, `articles-${today}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`数据已保存到 ${outputPath}`);

    // 4. 更新索引文件，记录所有可用日期
    const availableDates = getAvailableDates(dataDir);
    const indexData = {
      dates: availableDates,
      latest: today,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dataDir, 'index.json'),
      JSON.stringify(indexData, null, 2)
    );
    console.log(`索引已更新，共 ${availableDates.length} 天数据`);

    // 5. 清理超过 30 天的旧文件
    cleanupOldFiles(dataDir);

    console.log(`共 ${articles.length} 篇文章`);
  } catch (err) {
    console.error('抓取失败:', err.message);
    process.exit(1);
  }
}

main();
