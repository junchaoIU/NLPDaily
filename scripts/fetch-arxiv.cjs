/**
 * 抓取 arxiv cs.CL 文章
 * 每天保存为独立文件 data/articles-YYYY-MM-DD.json
 * 
 * 用法:
 *   node scripts/fetch-arxiv.cjs              # 抓取当天（回退到最近有论文的一天）
 *   node scripts/fetch-arxiv.cjs 2025-01-15   # 抓取指定日期
 *   node scripts/fetch-arxiv.cjs --backfill   # 补抓过去7天数据
 */

const fs = require('fs');
const path = require('path');

// 从命令行参数获取日期
const arg = process.argv[2];

// 获取日期字符串 YYYY-MM-DD
function getDateString(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取指定日期的 UTC Date 对象
function getDateFromString(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// 获取日期范围用于 arxiv 查询
function getDateRange(dateStr) {
  const dateNum = dateStr.replace(/-/g, '');
  return {
    start: `${dateNum}000000`,
    end: `${dateNum}235959`,
  };
}

// 构建 arxiv API 查询 URL
function buildArxivUrl(dateStr) {
  const { start, end } = getDateRange(dateStr);
  const query = `search_query=cat:cs.CL+AND+submittedDate:[${start}+TO+${end}]&sortBy=submittedDate&sortOrder=descending&max_results=2000`;
  return `http://export.arxiv.org/api/query?${query}`;
}

// 并发控制
const CONCURRENCY = 5;

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

    const uniqueAffiliations = [...new Set(affiliations)].slice(0, article.authors.length);

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
    .sort((a, b) => b.localeCompare(a));
  
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

/**
 * 抓取指定日期的文章
 */
async function fetchDateArticles(dateStr) {
  const url = buildArxivUrl(dateStr);
  console.log(`请求 arxiv API (${dateStr})...`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AcademicAssistant/1.0 (research tool; contact via GitHub)',
    },
  });

  if (!response.ok) {
    throw new Error(`arxiv API 返回 ${response.status}`);
  }

  const xml = await response.text();
  let articles = parseAtomXml(xml);
  console.log(`  ${dateStr}: 获取到 ${articles.length} 篇文章`);

  if (articles.length === 0) {
    return { articles, date: dateStr };
  }

  // 抓取作者单位
  console.log(`  抓取作者单位信息...`);
  const tasks = articles.map((article) => () => fetchAffiliations(article));
  articles = await runWithConcurrency(tasks, CONCURRENCY);

  return { articles, date: dateStr };
}

/**
 * 保存数据到文件
 */
function saveData(dataDir, dateStr, articles) {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const data = {
    articles,
    fetchedAt: new Date().toISOString(),
    count: articles.length,
    date: dateStr,
  };

  const outputPath = path.join(dataDir, `articles-${dateStr}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  console.log(`  数据已保存到 ${outputPath}`);

  // 更新索引
  const availableDates = getAvailableDates(dataDir);
  const indexData = {
    dates: availableDates,
    latest: availableDates[0] || dateStr,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    path.join(dataDir, 'index.json'),
    JSON.stringify(indexData, null, 2)
  );
}

/**
 * 抓取当天数据，如果当天没有论文则回退到最近有论文的一天
 */
async function fetchTodayWithFallback(dataDir) {
  const today = getDateString(new Date());
  
  // 尝试当天
  let result = await fetchDateArticles(today);
  
  if (result.articles.length === 0) {
    console.log(`当天 (${today}) 没有论文，回退查找最近有论文的一天...`);
    
    // 向前查找最近7天
    for (let i = 1; i <= 7; i++) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      const dateStr = getDateString(date);
      
      result = await fetchDateArticles(dateStr);
      
      if (result.articles.length > 0) {
        console.log(`  找到 ${dateStr} 有 ${result.articles.length} 篇论文，作为当天数据`);
        // 保存到该日期的文件
        saveData(dataDir, dateStr, result.articles);
        // 同时保存为 "latest" 文件，前端默认加载
        const latestData = {
          articles: result.articles,
          fetchedAt: new Date().toISOString(),
          count: result.articles.length,
          date: dateStr,
          isFallback: true,
        };
        fs.writeFileSync(
          path.join(dataDir, 'articles-latest.json'),
          JSON.stringify(latestData, null, 2)
        );
        console.log(`  已保存为 latest 数据`);
        return;
      }
    }
    
    console.log(`最近7天都没有论文数据`);
    // 即使没论文也保存当天数据
    saveData(dataDir, today, result.articles);
    return;
  }
  
  saveData(dataDir, today, result.articles);
  
  // 同时保存为 latest
  const latestData = {
    articles: result.articles,
    fetchedAt: new Date().toISOString(),
    count: result.articles.length,
    date: today,
  };
  fs.writeFileSync(
    path.join(dataDir, 'articles-latest.json'),
    JSON.stringify(latestData, null, 2)
  );
}

/**
 * 补抓过去N天数据
 */
async function backfill(dataDir, days) {
  console.log(`开始补抓过去 ${days} 天数据...`);
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - i);
    const dateStr = getDateString(date);
    
    // 检查是否已有数据
    const filePath = path.join(dataDir, `articles-${dateStr}.json`);
    if (fs.existsSync(filePath)) {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (existing.articles && existing.articles.length > 0) {
        console.log(`  ${dateStr}: 已有 ${existing.articles.length} 篇文章，跳过`);
        continue;
      }
    }
    
    try {
      const result = await fetchDateArticles(dateStr);
      saveData(dataDir, dateStr, result.articles);
      
      // 礼貌延迟，避免频繁请求
      if (i < days - 1) {
        console.log('  等待 3 秒...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    } catch (err) {
      console.error(`  ${dateStr} 抓取失败: ${err.message}`);
    }
  }
  
  // 生成 latest 文件（取最新有论文的一天）
  const availableDates = getAvailableDates(dataDir);
  for (const dateStr of availableDates) {
    const filePath = path.join(dataDir, `articles-${dateStr}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (data.articles && data.articles.length > 0) {
      const latestData = {
        ...data,
        fetchedAt: new Date().toISOString(),
        isFallback: dateStr !== getDateString(new Date()),
      };
      fs.writeFileSync(
        path.join(dataDir, 'articles-latest.json'),
        JSON.stringify(latestData, null, 2)
      );
      console.log(`latest 数据设为 ${dateStr} (${data.articles.length} 篇)`);
      break;
    }
  }
}

async function main() {
  const dataDir = path.join(__dirname, '..', 'data');
  
  try {
    if (arg === '--backfill') {
      // 补抓过去7天
      await backfill(dataDir, 7);
    } else if (arg) {
      // 抓取指定日期
      console.log(`抓取 ${arg} 的文章...`);
      const result = await fetchDateArticles(arg);
      saveData(dataDir, arg, result.articles);
    } else {
      // 默认抓取当天（带回退）
      console.log('开始抓取 arxiv cs.CL 当天文章...');
      await fetchTodayWithFallback(dataDir);
    }
    
    // 清理旧文件
    cleanupOldFiles(dataDir);
    
    // 更新索引
    const availableDates = getAvailableDates(dataDir);
    const indexData = {
      dates: availableDates,
      latest: availableDates[0] || '',
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(dataDir, 'index.json'),
      JSON.stringify(indexData, null, 2)
    );
    console.log(`索引已更新，共 ${availableDates.length} 天数据`);
  } catch (err) {
    console.error('抓取失败:', err.message);
    process.exit(1);
  }
}

main();
