#!/usr/bin/env bash
# 新增一間分店（加盟店）：不需要改程式，只是用同一個 branch-api image 多開一個 container
# 用法：bash scripts/add-branch.sh <分店代碼> <分店名稱> <城市> [地址]
# 範例：bash scripts/add-branch.sh kaohsiung 高雄巨蛋店 高雄市 "高雄市左營區博愛二路 777 號"
set -euo pipefail
cd "$(dirname "$0")/.."

if [ $# -lt 3 ]; then
  echo "用法: bash scripts/add-branch.sh <分店代碼> <分店名稱> <城市> [地址]"
  echo "範例: bash scripts/add-branch.sh kaohsiung 高雄巨蛋店 高雄市 \"高雄市左營區博愛二路 777 號\""
  exit 1
fi

CODE="$1"
NAME="${2//\"/}"
CITY="${3//\"/}"
ADDRESS="${4:-}"
ADDRESS="${ADDRESS//\"/}"

if ! [[ "$CODE" =~ ^[a-z0-9-]{2,40}$ ]]; then
  echo "錯誤：分店代碼只能使用小寫英文、數字與 -（2~40 字）"
  exit 1
fi

case "$CODE" in
  hq|login|api|assets|drinks)
    echo "錯誤：$CODE 是系統保留字（網站路徑已使用），請換一個分店代碼"
    exit 1 ;;
esac

OVERRIDE=docker-compose.override.yml
if grep -qs "^  branch-$CODE:" docker-compose.yml "$OVERRIDE"; then
  echo "錯誤：分店 $CODE 已經存在"
  exit 1
fi

[ -f "$OVERRIDE" ] || echo "services:" > "$OVERRIDE"

cat >> "$OVERRIDE" <<EOF

  branch-$CODE:
    build: ./branch-api
    image: drinkchain/branch-api:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      PGHOST: postgres
      PGUSER: \${POSTGRES_USER:-drink}
      PGPASSWORD: \${POSTGRES_PASSWORD:-drink123}
      HQ_URL: http://hq-api:3000
      JWT_SECRET: \${JWT_SECRET:-please-change-this-jwt-secret}
      INTERNAL_TOKEN: \${INTERNAL_TOKEN:-please-change-this-internal-token}
      TZ: Asia/Taipei
      BRANCH_CODE: "$CODE"
      BRANCH_NAME: "$NAME"
      BRANCH_CITY: "$CITY"
      BRANCH_ADDRESS: "$ADDRESS"
EOF

echo "已將分店 $CODE 加入 $OVERRIDE，啟動中…"
docker compose up -d --build "branch-$CODE"
echo
echo "完成！約 10 秒後即可使用："
echo "  點餐頁：   http://<主機IP>/$CODE"
echo "  店長後台： http://<主機IP>/$CODE/admin"
echo "  店長帳號： $CODE-manager（預設密碼請見 .env 的 DEFAULT_MANAGER_PASSWORD，預設 manager123）"
