#!/bin/bash
cd /opt/NLPDaily

# 文件锁：防止定时任务与手动补抓并发运行（两者共用同一把锁）
exec 200>/var/lock/nlpdaily-fetch.lock
flock -n 200 || { echo "$(date): 已有抓取进程在运行，本次跳过" >> /var/log/nlpdaily-fetch.log; exit 0; }

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

# 数据新鲜度自检：latest 距今超过 3 天则打 WARNING 到日志，方便巡检时发现静默断更
# （2026-09 曾因 arxiv 网关拒绝旧查询语法而静默断更一个月，脚本退出码仍为 0）
python3 - <<'EOF' 2>&1 | tee -a /var/log/nlpdaily-fetch.log
import json
from datetime import datetime, timezone
try:
    d = json.load(open('data/index.json'))
    latest = d.get('latest', '')
    if latest:
        diff = (datetime.now(timezone.utc) - datetime.fromisoformat(latest)).days
        if diff >= 3:
            print(f'WARNING: 数据已 {diff} 天未更新 (latest={latest})，抓取链路可能异常，请检查上方日志！')
        else:
            print(f'新鲜度正常: latest={latest} (滞后 {diff} 天)')
except Exception as e:
    print(f'WARNING: 数据新鲜度自检失败: {e}')
EOF

git add data/
git diff --staged --quiet || git commit -m "Update arxiv articles data for $(date +%Y-%m-%d)"
git push origin main 2>&1 | tee -a /var/log/nlpdaily-fetch.log

echo "EXIT_CODE=$EXIT_CODE" | tee -a /var/log/nlpdaily-fetch.log
exit $EXIT_CODE
