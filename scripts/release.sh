#!/usr/bin/env bash
# 發布新版本到 Docker Hub：每個 image 同時推送「版本號」與「latest」兩個 tag
# 用法：sudo bash scripts/release.sh <版本號>
# 範例：sudo bash scripts/release.sh 1.0
# 執行前請先登入：sudo docker login
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${1:-}"
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
  echo "用法: sudo bash scripts/release.sh <版本號>   例如 1.0、1.1、2.0"
  exit 1
fi

REPO=yearafter
IMAGES=(drinkchain-hq-api drinkchain-branch-api drinkchain-gateway)

echo "==> 建置版本 $VERSION"
# branch-taipei 代表分店 image（6 間分店共用同一個 image，build 一次即可）
IMAGE_TAG="$VERSION" docker compose build hq-api gateway branch-taipei

for img in "${IMAGES[@]}"; do
  echo "==> 推送 $REPO/$img:$VERSION 與 $REPO/$img:latest"
  docker tag "$REPO/$img:$VERSION" "$REPO/$img:latest"
  docker push "$REPO/$img:$VERSION"
  docker push "$REPO/$img:latest"
done

echo
echo "完成！已發布版本 $VERSION："
for img in "${IMAGES[@]}"; do
  echo "  https://hub.docker.com/r/$REPO/$img/tags"
done
echo
echo "建議同時在 Git 標記版本：git tag v$VERSION && git push origin v$VERSION"
