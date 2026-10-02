#!/usr/bin/env bash
# ฝั่ง VPS: ติดตั้งไว้ที่ /usr/local/bin/workpath-deploy (สำเนาต้นฉบับอยู่ใน repo ที่ scripts/vps/workpath-deploy.sh
# — แก้ไฟล์นี้แล้วต้อง copy ขึ้น VPS เองด้วย ไม่ได้อัปเดตตาม deploy)
#
# ถูกเรียก 2 ทาง:
#   1. GitHub Actions — ผ่าน SSH key ที่ถูกล็อกด้วย command="/usr/local/bin/workpath-deploy" ใน
#      /root/.ssh/authorized_keys key นั้นรันได้แค่สคริปต์นี้ คำสั่งที่ส่งมาอยู่ใน $SSH_ORIGINAL_COMMAND
#   2. คนที่มี SSH root เต็ม (scripts/deploy-vps-backend.sh) — เรียกตรงพร้อม argument
#
# คำสั่งที่รับ:
#   status          — แสดง commit ที่ deploy อยู่ + health
#   deploy <sha>    — อ่าน tar.gz ของโค้ดจาก stdin แล้ว deploy (คำสั่งอื่นถูกปฏิเสธทั้งหมด)
set -euo pipefail

DIR=/opt/workpath-backend
KEEP_BACKUPS=5
HEALTH=http://127.0.0.1:3003/api/health

read -r -a ARGS <<< "${SSH_ORIGINAL_COMMAND:-$*}"
MODE="${ARGS[0]:-}"
SHA="${ARGS[1]:-unknown}"

case "$MODE" in
  status)
    echo "deployed: $(cat "$DIR/DEPLOYED_COMMIT" 2>/dev/null || echo unknown)"
    curl -fsS "$HEALTH"; echo
    exit 0
    ;;
  deploy) ;;
  *)
    echo "ใช้ได้แค่: status | deploy <sha>" >&2
    exit 2
    ;;
esac

[[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || { echo "sha ไม่ถูกต้อง: $SHA" >&2; exit 2; }

# กัน deploy ซ้อนกัน (เช่น push ติดกัน 2 ครั้ง)
exec 9>/var/lock/workpath-deploy.lock
flock -w 600 9 || { echo "มี deploy อื่นค้างอยู่เกิน 10 นาที" >&2; exit 1; }

# ตรวจของที่ส่งมาให้ครบก่อนแตะอะไรบนเครื่อง — ส่งมาผิด/ว่าง ต้องไม่ลบโค้ดเดิมทิ้ง
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
head -c 50000000 > "$TMP/code.tgz"
tar -xzf "$TMP/code.tgz" -C "$TMP" || { echo "ไฟล์ที่ส่งมาไม่ใช่ tar.gz ที่ถูกต้อง" >&2; exit 1; }
for f in server/index.ts package.json package-lock.json tsconfig.json src/data; do
  [ -e "$TMP/$f" ] || { echo "ไฟล์ที่ส่งมาขาด $f" >&2; exit 1; }
done

BACKUP="$DIR.bak-$(date +%Y%m%d-%H%M%S)"
cp -a "$DIR" "$BACKUP"
echo "▶ backup: $BACKUP"

rollback() {
  echo "❌ $1 — ย้อนกลับเป็น $BACKUP" >&2
  rm -rf "$DIR" && cp -a "$BACKUP" "$DIR" && cd "$DIR" && docker compose up -d --build >/dev/null 2>&1 \
    && echo "ย้อนกลับแล้ว" >&2 || echo "⚠️ ย้อนกลับไม่สำเร็จ ต้องเข้าไปแก้มือ" >&2
  exit 1
}

cd "$DIR"
rm -rf server src/data
cp -a "$TMP/server" server
mkdir -p src && cp -a "$TMP/src/data" src/data
cp "$TMP/package.json" "$TMP/package-lock.json" "$TMP/tsconfig.json" .

docker compose up -d --build 2>&1 | tail -4 || rollback "build ไม่สำเร็จ"

for _ in $(seq 1 30); do
  curl -fs "$HEALTH" >/dev/null && break
  sleep 2
done
curl -fsS "$HEALTH" >/dev/null || rollback "health check ไม่ผ่านหลัง deploy"

echo "$SHA" > "$DIR/DEPLOYED_COMMIT"
ls -dt "$DIR".bak-* 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | xargs -r rm -rf
echo "✅ deployed $SHA"
curl -fsS "$HEALTH"; echo
