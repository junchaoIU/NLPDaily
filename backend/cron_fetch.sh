#!/bin/bash
set -e
cd /opt/NLPDaily

# 加载环境变量（如果存在 .env 文件）
if [ -f backend/.env ]; then
  export $(grep -v '^#' backend/.env | xargs)
fi

python3 backend/fetch_arxiv.py 2>&1 | tee /var/log/nlpdaily-fetch.log
git add data/
git diff --staged --quiet || git commit -m "Update arxiv articles data for $(date +%Y-%m-%d)"
git push origin main 2>&1 | tee -a /var/log/nlpdaily-fetch.log
