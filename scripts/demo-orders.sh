#!/usr/bin/env bash
# 產生示範訂單，讓總部與分店後台有營收資料可以看
# 用法：bash scripts/demo-orders.sh [每間分店的訂單數，預設 5] [網址，預設 http://localhost]
set -euo pipefail
COUNT="${1:-5}"
BASE="${2:-http://localhost}"
SUGAR=("正常糖" "少糖" "半糖" "微糖" "無糖")
ICE=("正常冰" "少冰" "微冰" "去冰" "熱飲")

CODES=$(curl -fsS "$BASE/api/hq/branches" | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
if [ -z "$CODES" ]; then
  echo "找不到任何分店，請確認系統已啟動（docker compose ps）"
  exit 1
fi

for code in $CODES; do
  for _ in $(seq "$COUNT"); do
    drink=$((RANDOM % 5 + 1))
    qty=$((RANDOM % 3 + 1))
    body="{\"items\":[{\"source\":\"common\",\"drinkId\":$drink,\"qty\":$qty,\"sugar\":\"${SUGAR[RANDOM % 5]}\",\"ice\":\"${ICE[RANDOM % 5]}\"}]}"
    curl -fsS -X POST "$BASE/api/branch/$code/orders" -H 'Content-Type: application/json' -d "$body" > /dev/null
  done
  echo "已為 $code 建立 $COUNT 筆訂單"
done
