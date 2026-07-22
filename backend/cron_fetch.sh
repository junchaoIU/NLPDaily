#!/bin/bash
cd /opt/NLPDaily

# 加载环境变量（如果存在 .env 文件）
if [ -f backend/.env ]; then
  set -a
  . backend/.env
  set +a
fi

# 运行采集脚本（即使失败也继续执行 git 操作）
python3 -u backend/fetch_arxiv.py 2>&1 | tee /var/log/nlpdaily-fetch.log
EXIT_CODE=$?

git add data/
git diff --staged --quiet || git commit -m "Update arxiv articles data for $(date +%Y-%m-%d)"
git push origin main 2>&1 | tee -a /var/log/nlpdaily-fetch.log

exit $EXIT_CODE