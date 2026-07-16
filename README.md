# 学术助手 - arxiv NLP 每日速递

自动抓取 arxiv cs.CL (Computation and Language) 分类每日新论文，提供中英双语展示，支持搜索、分类筛选和历史日期回溯。

在线访问：https://junchaoiu.github.io/NLPDaily/

---

## 功能特性

- **每日自动更新**：服务器每天 UTC 00:00 自动抓取并翻译
- **中英双语切换**：标题和摘要均支持中英文切换查看
- **搜索过滤**：支持按标题、作者、摘要搜索，按分类标签过滤
- **历史回溯**：下拉选择不同日期查看历史文章
- **直达原文**：一键跳转到 arxiv 摘要页或 PDF

---

## 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   服务器后端     │     │   GitHub 仓库    │     │   GitHub Pages  │
│                 │     │                 │     │                 │
│  backend/       │────►│  data/          │────►│  frontend/      │
│  cron_fetch.sh  │     │  frontend/      │     │  build + deploy │
│  fetch_arxiv.py │     │  backend/       │     │                 │
│  ↓ arxiv API    │     │                 │     │                 │
│  ↓ GLM API 翻译 │     │ GitHub Actions  │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Tailwind CSS + Vite |
| **后端** | Python 3 (标准库) |
| **翻译** | 智谱 GLM-4-Flash API |
| **部署** | GitHub Pages (前端) + 服务器定时任务 (后端) |
| **数据源** | arxiv API (Atom XML) |

---

## 项目结构

```
Academic_Assistant/
├── backend/                    # 后端脚本
│   ├── .env                   # API Key（gitignore，不上传）
│   ├── .env.example           # 环境变量模板
│   ├── cron_fetch.sh          # 服务器定时任务脚本
│   ├── fetch_arxiv.py         # 核心采集+翻译脚本
│   └── requirements.txt       # Python 依赖（无外部包）
│
├── frontend/                   # 前端代码
│   ├── src/
│   │   ├── components/        # React 组件
│   │   ├── types/             # TypeScript 类型定义
│   │   ├── App.tsx            # 主应用
│   │   └── main.tsx           # 入口
│   ├── index.html
│   ├── package.json
│   └── vite.config.ts
│
├── data/                       # 数据文件（JSON）
│   ├── index.json             # 日期索引
│   ├── articles-latest.json   # 最新一天数据
│   └── articles-YYYY-MM-DD.json  # 按日期存储
│
├── .github/
│   └── workflows/
│       └── deploy.yml         # GitHub Actions：build + deploy
│
├── .gitignore                 # 排除 .env、node_modules 等
└── README.md
```

---

## 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev      # 启动开发服务器
npm run build    # 构建生产版本
```

### 后端脚本（本地测试）

```bash
cd backend

# 创建 .env 文件
echo "TRANSLATE_API_KEY=your_api_key" > .env

# 抓取当天数据
python3 fetch_arxiv.py

# 补抓过去7天
python3 fetch_arxiv.py --backfill

# 补充翻译已有数据
python3 fetch_arxiv.py --translate
```

---

## 部署配置

### 1. 服务器定时任务

```bash
# 编辑 crontab
crontab -e

# 添加（每天 UTC 00:00 执行）
0 0 * * * /opt/NLPDaily/backend/cron_fetch.sh
```

### 2. GitHub Pages

- 仓库 Settings > Pages > Source 选择 "GitHub Actions"
- push 到 main 分支自动触发 build + deploy

### 3. API Key 配置

在服务器 `backend/.env` 中配置：

```
TRANSLATE_API_KEY=your_glm_api_key
```

**注意**：`.env` 已加入 `.gitignore`，不会上传到 GitHub。

---

## 数据格式

### 单篇文章

```json
{
  "id": "2501.12345",
  "title": "论文英文标题",
  "titleCn": "论文中文标题",
  "authors": [
    { "name": "作者名", "affiliation": "单位" }
  ],
  "abstract": "英文摘要...",
  "abstractCn": "中文摘要...",
  "categories": ["cs.CL", "cs.AI"],
  "published": "2025-01-15T00:00:00Z",
  "absUrl": "https://arxiv.org/abs/2501.12345",
  "pdfUrl": "https://arxiv.org/pdf/2501.12345.pdf",
  "comment": "ACL 2025"
}
```

### 索引文件

```json
{
  "dates": ["2025-01-15", "2025-01-14"],
  "latest": "2025-01-15",
  "updatedAt": "2025-01-15T00:00:00.000Z"
}
```

---

## 自定义配置

### 修改抓取分类

编辑 `backend/fetch_arxiv.py`：

```python
# 默认抓取 cs.CL，可改为 cs.AI、cs.LG 等
query = f'search_query=cat:cs.CL+AND+submittedDate:[{start}+TO+{end}]'
```

### 修改翻译模型

```python
TRANSLATE_MODEL = 'glm-4-flash-250414'  # 或其他智谱模型
```

---

## 许可证

MIT
