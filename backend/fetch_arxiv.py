"""
抓取 arxiv cs.CL 文章
用法:
  python fetch_arxiv.py              # 抓取当天（回退到最近有论文的一天）
  python fetch_arxiv.py 2025-01-15   # 抓取指定日期
  python fetch_arxiv.py --backfill   # 补抓过去7天数据
"""

import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import concurrent.futures
from datetime import datetime, timedelta, timezone

# 加载 .env 文件（如果存在）
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip().strip('"\''))

DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
CONCURRENCY = 5
TRANSLATE_CONCURRENCY = 1
HEADERS = {'User-Agent': 'AcademicAssistant/1.0 (research tool; contact via GitHub)'}

# 智谱 GLM 官方翻译 API 配置（单模型低并发，免费额度）
TRANSLATE_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
TRANSLATE_API_KEY = os.environ.get('TRANSLATE_API_KEY', '')
TRANSLATE_MODEL = 'glm-4-flash-250414'


def get_date_string(dt):
    """获取日期字符串 YYYY-MM-DD"""
    return dt.strftime('%Y-%m-%d')


def get_date_range(date_str):
    """获取日期范围用于 arxiv 查询"""
    date_num = date_str.replace('-', '')
    return f'{date_num}000000', f'{date_num}235959'


def build_arxiv_url(date_str):
    """构建 arxiv API 查询 URL"""
    start, end = get_date_range(date_str)
    query = f'search_query=cat:cs.CL+AND+submittedDate:[{start}+TO+{end}]&sortBy=submittedDate&sortOrder=descending&max_results=2000'
    return f'https://export.arxiv.org/api/query?{query}'


def http_get(url):
    """HTTP GET 请求"""
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode('utf-8')


def parse_atom_xml(xml):
    """解析 arxiv Atom XML 响应"""
    entries = []
    for entry_match in re.finditer(r'<entry>([\s\S]*?)</entry>', xml):
        entry = entry_match.group(1)

        def find(tag):
            m = re.search(rf'<{tag}>([\s\S]*?)</{tag}>', entry)
            return m.group(1).strip() if m else ''

        id_match = re.search(r'<id>([^<]+)</id>', entry)
        id_val = id_match.group(1).split('/')[-1] if id_match else ''

        # 提取分类
        categories = list(set(re.findall(r'<category term="([^"]+)"', entry)))

        # 提取作者
        authors = []
        for author_match in re.finditer(r'<author>[\s\S]*?<name>([^<]+)</name>[\s\S]*?</author>', entry):
            authors.append({'name': author_match.group(1), 'affiliation': ''})

        # 提取评论
        comment_match = re.search(r'<arxiv:comment>([^<]+)</arxiv:comment>', entry)
        comment = comment_match.group(1).strip() if comment_match else None

        title = re.sub(r'\n\s*', ' ', find('title')).strip()
        abstract = re.sub(r'\n\s*', ' ', find('summary')).strip()

        entries.append({
            'id': id_val,
            'title': title,
            'authors': authors,
            'abstract': abstract,
            'categories': categories,
            'published': find('published'),
            'updated': find('updated'),
            'absUrl': f'https://arxiv.org/abs/{id_val}',
            'pdfUrl': f'https://arxiv.org/pdf/{id_val}.pdf',
            'comment': comment,
        })

    return entries


def fetch_affiliations(article):
    """抓取单篇文章的摘要页，解析作者单位"""
    try:
        url = f'https://arxiv.org/abs/{article["id"]}'
        html = http_get(url)

        affiliations = []

        # 模式1: affiliation class
        for m in re.finditer(r'<span[^>]*class="[^"]*affiliation[^"]*"[^>]*>([^<]+)</span>', html, re.IGNORECASE):
            affiliations.append(m.group(1).strip())

        # 模式2: 括号中的单位
        for m in re.finditer(r'\(([^)]+)\)', html):
            text = m.group(1).strip()
            if 3 < len(text) < 200 and 'http' not in text:
                affiliations.append(text)

        # 模式3: dateline 附近
        dateline_match = re.search(r'<div[^>]*class="[^"]*dateline[^"]*"[^>]*>([\s\S]*?)</div>', html, re.IGNORECASE)
        if dateline_match:
            for m in re.finditer(r'>([^<]+)<', dateline_match.group(1)):
                text = m.group(1).strip()
                if 3 < len(text) < 200:
                    affiliations.append(text)

        # 去重
        unique = list(dict.fromkeys(affiliations))[:len(article['authors'])]

        # 分配给作者
        for idx, author in enumerate(article['authors']):
            author['affiliation'] = unique[idx] if idx < len(unique) else (unique[0] if unique else '')

        return article
    except Exception as e:
        print(f'  警告: 抓取 {article["id"]} 单位失败: {e}')
        return article


def translate_text(text):
    """使用智谱 GLM 官方 API 翻译文本为中文，低并发带重试"""
    if not text or not text.strip():
        return ''
    if not TRANSLATE_API_KEY:
        print('  跳过翻译：未配置 TRANSLATE_API_KEY 环境变量', flush=True)
        return ''
    body = json.dumps({
        'model': TRANSLATE_MODEL,
        'messages': [
            {'role': 'system', 'content': '你是一个专业的学术翻译。将用户提供的英文翻译成准确流畅的简体中文。只返回翻译结果，不要添加任何解释、注释或额外文字。'},
            {'role': 'user', 'content': text}
        ],
        'temperature': 0.3
    }).encode('utf-8')
    last_err = None
    for attempt in range(4):
        try:
            req = urllib.request.Request(
                TRANSLATE_API_URL,
                data=body,
                headers={
                    'Authorization': f'Bearer {TRANSLATE_API_KEY}',
                    'Content-Type': 'application/json'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=60) as resp:
                result = json.loads(resp.read().decode('utf-8'))
            # 节流：每次成功调用后等待 60 秒，避免触发免费 API 速率限制
            time.sleep(60)
            return result['choices'][0]['message']['content'].strip()
        except urllib.error.HTTPError as e:
            last_err = e
            body_text = ''
            try:
                body_text = e.read().decode()
            except Exception:
                pass
            # 余额不足 / 鉴权失败：直接终止
            if 'quota' in body_text or e.code == 401:
                raise
            # 429 限流：退避重试
            if e.code == 429:
                wait = 5 * (attempt + 1)
                print(f'    限流，等待 {wait}s 重试 ({attempt+1}/4)', flush=True)
                time.sleep(wait)
                continue
            # 其他错误短暂重试
            time.sleep(2 * (attempt + 1))
            continue
        except Exception as e:
            last_err = e
            # 连接被拒绝：API 可能临时封锁，长退避
            if '10061' in str(e) or 'Connection refused' in str(e):
                wait = 30 * (attempt + 1)
                print(f'    连接被拒绝，等待 {wait}s 后重试 ({attempt+1}/4)', flush=True)
                time.sleep(wait)
            else:
                time.sleep(2 * (attempt + 1))
    raise last_err


def translate_article(article):
    """翻译单篇文章的标题和摘要"""
    try:
        article['titleCn'] = translate_text(article['title'])
    except Exception as e:
        print(f'  警告: 翻译标题 {article["id"]} 失败: {e}')
        article['titleCn'] = ''
    try:
        article['abstractCn'] = translate_text(article['abstract'])
    except Exception as e:
        print(f'  警告: 翻译摘要 {article["id"]} 失败: {e}')
        article['abstractCn'] = ''
    return article


def fetch_date_articles(date_str):
    """抓取指定日期的文章"""
    url = build_arxiv_url(date_str)
    print(f'请求 arxiv API ({date_str})...')

    xml = http_get(url)
    articles = parse_atom_xml(xml)
    print(f'  {date_str}: 获取到 {len(articles)} 篇文章')

    if not articles:
        return {'articles': articles, 'date': date_str}

    # 并发抓取单位
    print(f'  抓取作者单位信息...')
    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENCY) as executor:
        articles = list(executor.map(fetch_affiliations, articles))

    # 翻译标题和摘要为中文
    print(f'  翻译标题和摘要为中文...')
    with concurrent.futures.ThreadPoolExecutor(max_workers=TRANSLATE_CONCURRENCY) as executor:
        articles = list(executor.map(translate_article, articles))

    return {'articles': articles, 'date': date_str}


def get_available_dates(data_dir):
    """获取所有可用日期列表"""
    if not os.path.exists(data_dir):
        return []
    dates = []
    for f in os.listdir(data_dir):
        if f.startswith('articles-') and f.endswith('.json') and f != 'articles-latest.json':
            dates.append(f.replace('articles-', '').replace('.json', ''))
    dates.sort(reverse=True)
    return dates


def save_data(data_dir, date_str, articles):
    """保存数据到文件"""
    os.makedirs(data_dir, exist_ok=True)

    data = {
        'articles': articles,
        'fetchedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(articles),
        'date': date_str,
    }

    output_path = os.path.join(data_dir, f'articles-{date_str}.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'  数据已保存到 {output_path}')


def save_latest(data_dir, date_str, articles, is_fallback=False):
    """保存 latest 文件"""
    data = {
        'articles': articles,
        'fetchedAt': datetime.now(timezone.utc).isoformat(),
        'count': len(articles),
        'date': date_str,
        'isFallback': is_fallback,
    }
    path = os.path.join(data_dir, 'articles-latest.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f'  latest 数据已保存')


def update_index(data_dir):
    """更新索引文件"""
    dates = get_available_dates(data_dir)
    index_data = {
        'dates': dates,
        'latest': dates[0] if dates else '',
        'updatedAt': datetime.now(timezone.utc).isoformat(),
    }
    path = os.path.join(data_dir, 'index.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    print(f'索引已更新，共 {len(dates)} 天数据')


def fetch_today_with_fallback(data_dir):
    """抓取当天数据，回退到最近有论文的一天"""
    today = get_date_string(datetime.now(timezone.utc))
    result = fetch_date_articles(today)

    if result['articles']:
        save_data(data_dir, today, result['articles'])
        save_latest(data_dir, today, result['articles'])
        return

    print(f'当天 ({today}) 没有论文，回退查找最近有论文的一天...')
    for i in range(1, 8):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        date_str = get_date_string(date)
        result = fetch_date_articles(date_str)
        if result['articles']:
            print(f'  找到 {date_str} 有 {len(result["articles"])} 篇论文，作为 latest 数据')
            save_data(data_dir, date_str, result['articles'])
            save_latest(data_dir, date_str, result['articles'], is_fallback=True)
            return

    print('最近7天都没有论文数据')
    save_data(data_dir, today, [])


def backfill(data_dir, days):
    """补抓过去N天数据"""
    print(f'开始补抓过去 {days} 天数据...')
    for i in range(days):
        date = datetime.now(timezone.utc) - timedelta(days=i)
        date_str = get_date_string(date)

        # 检查是否已有数据
        file_path = os.path.join(data_dir, f'articles-{date_str}.json')
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                existing = json.load(f)
            if existing.get('articles'):
                print(f'  {date_str}: 已有 {len(existing["articles"])} 篇文章，跳过')
                continue

        try:
            result = fetch_date_articles(date_str)
            save_data(data_dir, date_str, result['articles'])
            if i < days - 1:
                print('  等待 3 秒...')
                time.sleep(3)
        except Exception as e:
            print(f'  {date_str} 抓取失败: {e}')

    # 生成 latest 文件
    dates = get_available_dates(data_dir)
    for date_str in dates:
        file_path = os.path.join(data_dir, f'articles-{date_str}.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get('articles'):
            today = get_date_string(datetime.now(timezone.utc))
            save_latest(data_dir, date_str, data['articles'], is_fallback=(date_str != today))
            print(f'latest 数据设为 {date_str} ({len(data["articles"])} 篇)')
            break


def translate_existing(data_dir):
    """为已存在的数据文件补充翻译（两阶段：先全部标题，再全部摘要，分段保存进度）"""
    dates = get_available_dates(data_dir)
    if not dates:
        print('没有可翻译的数据文件')
        return
    for date_str in dates:
        file_path = os.path.join(data_dir, f'articles-{date_str}.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        articles = data.get('articles', [])
        if not articles:
            print(f'  {date_str}: 无文章，跳过')
            continue
        if all(a.get('titleCn') for a in articles) and all(a.get('abstractCn') for a in articles):
            print(f'  {date_str}: 已有翻译，跳过')
            continue

        def _save():
            data['articles'] = articles
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        # 阶段1：翻译所有标题（跳过已翻译的，每10篇增量保存）
        todo_titles = [a for a in articles if not a.get('titleCn')]
        if todo_titles:
            print(f'  {date_str}: 阶段1 翻译 {len(todo_titles)} 个标题...', flush=True)
            for i, a in enumerate(articles):
                if a.get('titleCn'):
                    continue
                try:
                    a['titleCn'] = translate_text(a['title'])
                except Exception as e:
                    print(f'  警告: 翻译标题 {a["id"]} 失败: {e}', flush=True)
                    a['titleCn'] = ''
                if (i + 1) % 10 == 0:
                    print(f'    标题进度 {i + 1}/{len(articles)}', flush=True)
                    _save()
            _save()
            print(f'  {date_str}: 标题翻译完成，已保存', flush=True)

        # 阶段2：翻译所有摘要（跳过已翻译的，每10篇增量保存）
        todo_abs = [a for a in articles if not a.get('abstractCn')]
        if todo_abs:
            print(f'  {date_str}: 阶段2 翻译 {len(todo_abs)} 个摘要...', flush=True)
            for i, a in enumerate(articles):
                if a.get('abstractCn'):
                    continue
                try:
                    a['abstractCn'] = translate_text(a['abstract'])
                except Exception as e:
                    print(f'  警告: 翻译摘要 {a["id"]} 失败: {e}', flush=True)
                    a['abstractCn'] = ''
                if (i + 1) % 10 == 0:
                    print(f'    摘要进度 {i + 1}/{len(articles)}', flush=True)
                    _save()
            _save()
            print(f'  {date_str}: 摘要翻译完成，已保存', flush=True)

    # 刷新 latest 文件（用最新一天的已翻译数据）
    dates = get_available_dates(data_dir)
    for date_str in dates:
        file_path = os.path.join(data_dir, f'articles-{date_str}.json')
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if data.get('articles'):
            today = get_date_string(datetime.now(timezone.utc))
            save_latest(data_dir, date_str, data['articles'], is_fallback=(date_str != today))
            print(f'latest 已刷新为 {date_str}')
            break


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    arg = sys.argv[1] if len(sys.argv) > 1 else None

    try:
        if arg == '--backfill':
            backfill(DATA_DIR, 7)
        elif arg == '--translate':
            translate_existing(DATA_DIR)
        elif arg:
            print(f'抓取 {arg} 的文章...')
            result = fetch_date_articles(arg)
            save_data(DATA_DIR, arg, result['articles'])
        else:
            print('开始抓取 arxiv cs.CL 当天文章...')
            fetch_today_with_fallback(DATA_DIR)

        update_index(DATA_DIR)
    except Exception as e:
        print(f'抓取失败: {e}')
        sys.exit(1)


if __name__ == '__main__':
    main()
