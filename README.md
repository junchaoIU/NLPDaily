# 学术助手 - arxiv NLP 每日速递

一个自动抓取 arxiv cs.CL (Computation and Language) 分类每日新论文，并以优雅界面展示的工具。数据每天自动更新，支持查看历史日期的文章。

## 功能特性

- **每日自动抓取**: GitHub Actions 每天 UTC 00:00 自动抓取当天所有 cs.CL 论文
- **数据持久化**: 每天保存为独立文件，支持查看历史日期
- **优雅界面**: 深色学术风格，卡片式展示
- **搜索过滤**: 支持按标题、作者、摘要搜索，按分类标签过滤
- **展开摘要**: 点击展开/收起完整摘要
- **日期切换**: 下拉选择不同日期查看历史文章
- **直达原文**: 一键跳转到 arxiv 摘要页或 PDF

## 技术栈

- **前端**: React 18 + TypeScript + Tailwind CSS + Vite
- **部署**: GitHub Pages
- **数据抓取**: GitHub Actions + Node.js
- **数据源**: arxiv API (Atom XML)

## 快速开始

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/<your-username>/Academic_Assistant.git
cd Academic_Assistant

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建
npm run build
```

### 部署到 GitHub Pages

1. **Fork 或创建仓库**

2. **启用 GitHub Pages**
   - 进入仓库 Settings > Pages
   - Source 选择 "GitHub Actions"

3. **配置 Actions 权限**
   - Settings > Actions > General
   - Workflow permissions 选择 "Read and write permissions"

4. **手动触发第一次抓取**
   - 进入 Actions 标签页
   - 选择 "Fetch arxiv NLP Articles"
   - 点击 "Run workflow" 手动执行

5. **访问页面**
   - 等待 Actions 执行完成
   - 访问 `https://<your-username>.github.io/Academic_Assistant/`

## 项目结构

```
academic-assistant/
├── .github/
│   └── workflows/
│       └── fetch-arxiv.yml      # GitHub Actions 定时任务
├── scripts/
│   └── fetch-arxiv.js           # 数据抓取脚本
├── data/
│   ├── articles-YYYY-MM-DD.json  # 每日数据文件
│   └── index.json                # 日期索引
├── src/
│   ├── components/              # React 组件
│   ├── types/                   # TypeScript 类型
│   └── App.tsx                  # 主应用
├── index.html
├── package.json
├── vite.config.ts
└── README.md
```

## 数据说明

### 每日数据文件格式

```json
{
  "articles": [
    {
      "id": "2501.12345",
      "title": "论文标题",
      "authors": [
        { "name": "作者名", "affiliation": "单位" }
      ],
      "abstract": "论文摘要...",
      "categories": ["cs.CL", "cs.AI"],
      "published": "2025-01-15T00:00:00Z",
      "updated": "2025-01-15T00:00:00Z",
      "absUrl": "https://arxiv.org/abs/2501.12345",
      "pdfUrl": "https://arxiv.org/pdf/2501.12345.pdf",
      "comment": "会议信息（如有）"
    }
  ],
  "fetchedAt": "2025-01-15T00:00:00.000Z",
  "count": 42,
  "date": "2025-01-15"
}
```

### 索引文件格式

```json
{
  "dates": ["2025-01-15", "2025-01-14", "2025-01-13"],
  "latest": "2025-01-15",
  "updatedAt": "2025-01-15T00:00:00.000Z"
}
```

## 定时任务

默认每天 UTC 00:00 执行抓取。可以在 `.github/workflows/fetch-arxiv.yml` 中修改 cron 表达式：

```yaml
on:
  schedule:
    - cron: '0 0 * * *'  # 每天 UTC 00:00
```

## 数据保留

- 自动保留最近 30 天的数据
- 超过 30 天的旧文件自动清理

## 自定义配置

### 修改抓取分类

编辑 `scripts/fetch-arxiv.js` 中的查询参数：

```javascript
const query = `search_query=cat:cs.CL+AND+submittedDate:[${start}+TO+${end}]`;
```

将 `cs.CL` 替换为其他 arxiv 分类，如 `cs.AI`、`cs.LG` 等。

### 修改最大抓取数量

```javascript
const query = `...&max_results=2000`;  // 默认 2000 篇
```

## 许可证

MIT
