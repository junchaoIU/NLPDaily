#!/bin/bash
cd /opt/NLPDaily

# 加载环境变量（如果存在 .env 文件）
if [ -f backend/.env ]; then
  set -a
  . backend/.env
  set +a
fi

git config user.name "NLPDaily Bot"
git config user.email "nlpdaily-bot@localhost"

echo "===== $(date) =====" | tee /var/log/nlpdaily-fetch.log

# 先同步远端，避免本地落后导致 push 被拒
git pull --rebase origin main 2>&1 | tee -a /var/log/nlpdaily-fetch.log

# 自愈式抓取：补抓过去 14 天中缺失的数据（已有数据自动跳过）。
# 相比只抓"当天"，即使某天失败，后续运行也会自动补上，保证网站持续更新。
python3 -u backend/fetch_arxiv.py --backfill 2>&1 | tee -a /var/log/nlpdaily-fetch.log
EXIT_CODE=$?

git add data/
git diff --staged --quiet || git commit -m "Update arxiv articles data for $(date +%Y-%m-%d)"
git push origin main 2>&1 | tee -a /var/log/nlpdaily-fetch.log

echo "EXIT_CODE=$EXIT_CODE" | tee -a /var/log/nlpdaily-fetch.log
exit $EXIT_CODE
