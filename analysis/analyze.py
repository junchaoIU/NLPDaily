"""NLPDaily 趋势雷达 + 结构化周报（全本地、零 API）

用法：
    python analysis/analyze.py --data-dir data --out-dir analysis/output
    python analysis/analyze.py --data-dir data --report-week 2026-W42

产出：
    <out-dir>/trends.json            主题逐周趋势（供前端图表）
    <out-dir>/report-YYYY-Www.json   结构化周报（热点词/突现主题/主题聚类）
    控制台打印最新一周周报摘要与趋势亮点

依赖：numpy + scikit-learn（仅主题聚类使用）；其余为标准库。
"""
import argparse
import glob
import json
import math
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

# 英文功能词 + 学术通用词 + 领域泛词（单独出现时无信息量）
STOPWORDS = set('''
a an the and or but if then else when at by for with about into through during
before after above below to from up down in out on off over under again further
once here there all any both each few more most other some such no nor not only
own same so than too very can will just should now i me my we our you your he
him his she her it its they them their what which who whom this that these
those am is are was were be been being have has had having do does did doing
would could ought im youre hes shes its were theyve id youd hell shell
of as us via et al
we our paper papers propose proposed proposing present presented introduce
introduced novel new method methods approach approaches technique techniques
model models modeling framework frameworks system systems study studies work
works result results experiment experiments experimental evaluation evaluations
evaluating performance performances show shows shown demonstrate demonstrates
demonstrated outperform outperforms achieve achieves achieved achieving
state art baseline baselines benchmark benchmarks dataset datasets data task
tasks use used using uses utilize utilized utilizes based well also however
thus therefore moreover furthermore additionally respectively compared comparison
including include includes various many several various often may might must
shall let make makes made making take takes taken taking give gives given
giving find finds found finding get gets got getting go goes went going
one two three first second third last end etc ie eg vs per within without
across among between among upon along towards toward despite either neither
whether while although though since because due hence whereby wherein
high low large small good better best different similar same general specific
previous existing current recent finally overall particularly especially
main key important effective efficient effective robust significant significantly
significantly improve improves improved improving improvement improvements
accuracy accurate precision recall score scores metric metrics
learning training train trained testing test validation inference
language languages natural text texts textual word words sentence sentences
document documents corpus corpora token tokens sequence sequences
neural network networks deep machine artificial intelligence
human humans user users real world time times way ways
problem problems solution solutions process processing analysis analyze
application applications domain domains knowledge information content
number numbers part parts form forms type types level levels
set sets setting settings case cases example examples
'''.split())

STOPWORDS.update('''
how why whose still even much less least really quite nevertheless nonetheless
instead otherwise meanwhile somehow somewhat anywhere everywhere anything
everything something nothing anyone everyone someone nobody anybody everyone
consider considers considered considering require requires required requiring
provide provides provided providing develop develops developed developing
design designs designed designing apply applies applied applying
address addresses addressed addressing tackle tackles tackling solve solves
solved solving handle handles handling perform performs performed performing
enable enables enabled enabling allow allows allowed allowing focus focuses
focused focusing aim aims aimed aiming seek seeks seeking explore explores
explored exploring investigate investigates investigated investigating examine
examines examined examining analyse assess assesses assessed assessing evaluate
evaluates evaluated measure measures measured measuring compare compares
comparing report reports reported observe observes observed reveal reveals
revealed suggest suggests suggested indicate indicates indicated prove proves
yield yields lead leads leading led bring brings play plays role roles
challenge challenges limitation limitations future insight insights
understanding understand understands capability capabilities ability abilities
currently recently increasingly widely commonly typically generally usually
frequently primarily mainly mostly largely partly highly extremely specifically
substantially considerably effectively efficiently successfully consistently
directly indirectly simply easily clearly obviously naturally actually indeed
truly almost nearly approximately around ask asks asked asking
point points percentage percent yet rather remain remains remaining where
http https www com github org arxiv pdf html
'''.split())

# n-gram 内部允许出现的连接词（chain of thought 等）
CONNECTORS = {'of', 'and', 'for', 'in', 'on', 'the', 'a', 'to', 'with'}
# 这些领域泛词单独出现无信息量，但作为术语成分必须保留
# （large language model / language model / machine learning）
PHRASE_ALLOW = {'language', 'model', 'models', 'learning'}

TOKEN_RE = re.compile(r"[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
URL_RE = re.compile(r'https?://\S+|www\.\S+')
MIN_DF_BURST = 5          # 突现词本周至少出现的论文数
TREND_TOPIC_COUNT = 15    # 趋势图跟踪的主题数
REPORT_TOP_TERMS = 15     # 周报热点词数量
REPORT_TOP_BURSTS = 10    # 周报突现主题数量
CLUSTER_REPRESENTATIVES = 5


def tokenize(text):
    return TOKEN_RE.findall(text.lower())


def normalize_token(tok):
    """简单复数归一（llms→llm、agents→agent、families→family），
    排除 ss/us/is 结尾防误伤。"""
    if len(tok) > 4 and tok.endswith('ies'):
        return tok[:-3] + 'y'
    if len(tok) >= 4 and tok.endswith('s') and not tok.endswith(('ss', 'us', 'is')):
        return tok[:-1]
    return tok


def dedup_terms(items, get_term=lambda x: x['term'], overlap=1.0):
    """按顺序保留高优先级术语，跳过与已选者词面重叠过高的近邻。
    默认 overlap=1.0 只过滤包含关系（如 model llm 滤掉 language model llm）；
    趋势榜用 0.5 更严格，避免同一热点以不同搭配刷屏。"""
    kept, seen = [], []
    for item in items:
        tokens = set(get_term(item).split())
        if any(tokens & s and len(tokens & s) / min(len(tokens), len(s)) >= overlap
               for s in seen):
            continue
        kept.append(item)
        seen.append(tokens)
    return kept


def extract_terms(text):
    """从文本提取 1~3 gram 术语；首尾必须是实词，中间允许连接词与领域泛词。"""
    tokens = [normalize_token(t) for t in tokenize(URL_RE.sub(' ', text))]
    phrase_stop = STOPWORDS - PHRASE_ALLOW
    phrase_ok = CONNECTORS | PHRASE_ALLOW
    terms = set()
    n = len(tokens)
    for i, tok in enumerate(tokens):
        if len(tok) >= 3 and tok not in STOPWORDS:
            terms.add(tok)
        for size in (2, 3):
            if i + size > n:
                continue
            gram = tokens[i:i + size]
            if gram[0] in phrase_stop or gram[-1] in phrase_stop:
                continue
            if any(t in STOPWORDS and t not in phrase_ok for t in gram):
                continue
            if any(len(t) < 2 for t in gram):
                continue
            terms.add(' '.join(gram))
    return terms


def iso_week(date_str):
    d = datetime.strptime(date_str, '%Y-%m-%d').date()
    y, w, _ = d.isocalendar()
    return f'{y}-W{w:02d}'


def load_papers(data_dir):
    """加载全部论文，按 ISO 周分组。返回 {week: [paper]}，week 升序。"""
    weeks = defaultdict(list)
    for path in sorted(glob.glob(os.path.join(data_dir, 'articles-2*.json'))):
        date_str = os.path.basename(path)[len('articles-'):-len('.json')]
        try:
            with open(path, encoding='utf-8') as f:
                articles = json.load(f).get('articles', [])
        except Exception:
            continue
        for a in articles:
            text = (a.get('title') or '') + '. ' + (a.get('abstract') or '')
            weeks[iso_week(date_str)].append({
                'id': a.get('id', ''),
                'title': a.get('title', ''),
                'titleCn': a.get('titleCn', ''),
                'absUrl': a.get('absUrl', ''),
                'terms': extract_terms(text),
                'text': text,
            })
    return dict(sorted(weeks.items()))


def weekly_df(papers):
    """一周的术语文档频率（多少篇论文提到该术语）。"""
    df = Counter()
    for p in papers:
        df.update(p['terms'])
    return df


def pick_trend_topics(all_df, total_papers):
    """挑选全程趋势主题：优先多词术语（信息量高），过滤只在极短期爆发的噪声。"""
    candidates = [(term, df) for term, df in all_df.items()
                  if df >= max(10, total_papers * 0.005)]
    candidates.sort(key=lambda x: x[1], reverse=True)
    topics = dedup_terms([{'term': t} for t, _ in candidates],
                         get_term=lambda x: x['term'], overlap=0.5)
    return [t['term'] for t in topics[:TREND_TOPIC_COUNT]]


def find_bursts(this_df, this_n, base_df, base_n):
    """突现主题：本周占比相对前基线周的提升倍数（带平滑）。"""
    bursts = []
    for term, df in this_df.items():
        if df < MIN_DF_BURST:
            continue
        base = base_df.get(term, 0)
        # 要求基线较低，才算是"新"热点；占比至少翻倍且达到显著水平
        rate = df / max(this_n, 1)
        base_rate = (base + 0.5) / max(base_n, 1)
        lift = rate / base_rate
        if lift < 2.0:
            continue
        score = math.log2(lift) * math.log2(df + 1)
        bursts.append({'term': term, 'count': df, 'baselineCount': base,
                       'lift': round(lift, 1), 'score': round(score, 3)})
    bursts.sort(key=lambda x: x['score'], reverse=True)
    return dedup_terms(bursts)[:REPORT_TOP_BURSTS]


def cluster_week(papers, max_clusters=8):
    """TF-IDF + KMeans 主题聚类，返回主题名、规模、代表论文。"""
    from sklearn.cluster import KMeans
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    n = len(papers)
    k = max(2, min(max_clusters, n // 30))
    from sklearn.feature_extraction.text import ENGLISH_STOP_WORDS
    vectorizer = TfidfVectorizer(max_features=15000, ngram_range=(1, 2),
                                 min_df=2, sublinear_tf=True,
                                 stop_words=list(STOPWORDS | set(ENGLISH_STOP_WORDS)))
    matrix = vectorizer.fit_transform([p['text'] for p in papers])
    km = KMeans(n_clusters=k, n_init=10, random_state=42)
    labels = km.fit_predict(matrix)
    terms = vectorizer.get_feature_names_out()

    clusters = []
    for c in range(k):
        idx = [i for i, lab in enumerate(labels) if lab == c]
        if not idx:
            continue
        center = km.cluster_centers_[c]
        top_terms = [terms[i] for i in center.argsort()[::-1][:8]]
        sims = cosine_similarity(matrix[idx], center.reshape(1, -1)).ravel()
        ranked = sorted(zip(idx, sims), key=lambda x: x[1], reverse=True)
        reps = []
        for i, _ in ranked[:CLUSTER_REPRESENTATIVES]:
            p = papers[i]
            reps.append({'id': p['id'], 'title': p['title'],
                         'titleCn': p['titleCn'], 'absUrl': p['absUrl']})
        clusters.append({'terms': top_terms, 'size': len(idx),
                         'representatives': reps})
    clusters.sort(key=lambda x: x['size'], reverse=True)
    return clusters


def paper_brief(p):
    return {'id': p['id'], 'title': p['title'], 'titleCn': p['titleCn'],
            'absUrl': p['absUrl']}


def build_report(week, papers, baseline_dfs, baseline_n):
    n = len(papers)
    this_df = weekly_df(papers)
    base_df = Counter()
    for df in baseline_dfs:
        base_df.update(df)

    top_terms = dedup_terms([{'term': t, 'count': c}
                             for t, c in this_df.most_common(200)
                             if c >= 3])[:REPORT_TOP_TERMS]
    # 热点词优先展示多词术语，避免单词榜过于宽泛
    top_multi = dedup_terms([{'term': t, 'count': c}
                             for t, c in this_df.most_common(500)
                             if ' ' in t and c >= 3])[:REPORT_TOP_TERMS]

    bursts = find_bursts(this_df, n, base_df, baseline_n)
    clusters = cluster_week(papers)

    return {
        'week': week,
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'paperCount': n,
        'topTerms': top_terms,
        'topPhrases': top_multi,
        'bursts': bursts,
        'clusters': clusters,
    }


def print_report(report, prev_count):
    print('=' * 72)
    print(f"周报 {report['week']}  |  论文 {report['paperCount']} 篇", end='')
    if prev_count:
        delta = report['paperCount'] - prev_count
        print(f"（环比 {'+' if delta >= 0 else ''}{delta}）", end='')
    print('\n' + '=' * 72)

    print('\n【热点术语】')
    print('  ' + '；'.join(f"{t['term']}({t['count']})" for t in report['topPhrases'][:12]))

    print('\n【突现主题（本周 vs 前4周）】')
    for b in report['bursts'][:8]:
        print(f"  {b['term']:<42} {b['count']:>3} 篇  ×{b['lift']}")

    print('\n【主题聚类】')
    for i, c in enumerate(report['clusters'], 1):
        print(f"\n  {i}. {' / '.join(c['terms'][:4])}  —— {c['size']} 篇")
        for r in c['representatives'][:3]:
            title = r['titleCn'] or r['title']
            print(f"     · {title[:70]}")


def main():
    ap = argparse.ArgumentParser(description='NLPDaily 趋势雷达 + 结构化周报')
    ap.add_argument('--data-dir', default='data')
    ap.add_argument('--out-dir', default='data/analysis')
    ap.add_argument('--report-week', default=None, help='如 2026-W42，默认最新一周')
    ap.add_argument('--all-reports', action='store_true', help='回填所有历史周周报（首次部署用）')
    ap.add_argument('--trend-weeks', type=int, default=12, help='趋势图保留的周数')
    args = ap.parse_args()

    weeks = load_papers(args.data_dir)
    if not weeks:
        raise SystemExit(f'未在 {args.data_dir} 找到论文数据')
    week_names = list(weeks)
    print(f'共 {len(week_names)} 周、{sum(len(v) for v in weeks.values())} 篇论文')

    # 每周 DF 缓存
    dfs = {w: weekly_df(ps) for w, ps in weeks.items()}
    all_df = Counter()
    for df in dfs.values():
        all_df.update(df)
    total = sum(len(v) for v in weeks.values())

    # 全程趋势主题 + 逐周计数
    topics = pick_trend_topics(all_df, total)
    trend_weeks = week_names[-args.trend_weeks:]
    trends = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'weeks': trend_weeks,
        'weeklyPaperCounts': [len(weeks[w]) for w in trend_weeks],
        'topics': [{
            'term': t,
            'total': all_df[t],
            'weekly': [dfs[w].get(t, 0) for w in trend_weeks],
        } for t in topics],
    }
    os.makedirs(args.out_dir, exist_ok=True)
    trends_path = os.path.join(args.out_dir, 'trends.json')
    with open(trends_path, 'w', encoding='utf-8') as f:
        json.dump(trends, f, ensure_ascii=False, indent=2)

    # 周报（默认最新一周，基线为此前 4 周；--all-reports 回填全部历史周）
    report_week = args.report_week or week_names[-1]
    if report_week not in weeks:
        raise SystemExit(f'没有 {report_week} 的数据，可选：{", ".join(week_names)}')
    target_weeks = week_names if args.all_reports else [report_week]
    report = None
    prev_count = 0
    for rw in target_weeks:
        wi = week_names.index(rw)
        baseline_weeks = week_names[max(0, wi - 4):wi]
        report = build_report(rw, weeks[rw],
                              [dfs[w] for w in baseline_weeks],
                              sum(len(weeks[w]) for w in baseline_weeks))
        report_path = os.path.join(args.out_dir, f'report-{rw}.json')
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        prev_count = len(weeks[baseline_weeks[-1]]) if baseline_weeks else 0
        print(f'周报已生成: {report_path}', flush=True)

    # 周报索引：扫描已有 report 文件，供前端列出全部可选周
    existing = glob.glob(os.path.join(args.out_dir, 'report-*.json'))
    report_index = {
        'generatedAt': datetime.now(timezone.utc).isoformat(),
        'weeks': sorted((os.path.basename(p)[len('report-'):-len('.json')]
                         for p in existing), reverse=True),
    }
    with open(os.path.join(args.out_dir, 'reports.json'), 'w', encoding='utf-8') as f:
        json.dump(report_index, f, ensure_ascii=False, indent=2)

    if report:
        print_report(report, prev_count)

    print('\n【趋势亮点（全程热点主题近6周走势）】')
    for t in trends['topics'][:10]:
        seq = t['weekly'][-6:]
        print(f"  {t['term']:<40} {seq}")
    print(f'\n已输出: {trends_path}\n        {report_path}')


if __name__ == '__main__':
    main()
