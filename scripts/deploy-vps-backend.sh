#!/usr/bin/env bash
# Deploy backend ขึ้น VPS (workpath-api.wonghiran.com) แบบมือ — ใช้: npm run deploy:vps
#
# ปกติไม่ต้องใช้: push ขึ้น main ที่แก้ server/ แล้ว GitHub Actions (.github/workflows/deploy-vps-backend.yml)
# deploy ให้เอง สคริปต์นี้มีไว้กรณีต้อง deploy เองหรือ Actions ใช้ไม่ได้
#
# ส่งโค้ดจาก commit HEAD (ไม่รวมไฟล์ที่แก้ค้าง) ไปให้ /usr/local/bin/workpath-deploy บน VPS
# (scripts/vps/workpath-deploy.sh) ซึ่งตรวจไฟล์ → backup → build container ใหม่ → เช็ค health → ย้อนกลับเองถ้าพัง
# ต้องมี SSH root เข้า 178.128.119.174 ได้ ตั้ง host ผ่าน env VPS_HOST (ค่าเริ่มต้น alias `Smart-Jigsaw` ใน ~/.ssh/config)
# ⚠️ migration ไม่ได้รันให้ — apply schema ใหม่กับฐานข้อมูลจริงก่อน deploy เสมอ (ดู Setup_Deployment_Guide.md)
set -euo pipefail

VPS_HOST="${VPS_HOST:-Smart-Jigsaw}"
PUBLIC_HEALTH=https://workpath-api.wonghiran.com/api/health

cd "$(git rev-parse --show-toplevel)"

git fetch -q origin
SHA=$(git rev-parse HEAD)
if [ "$SHA" != "$(git rev-parse origin/main)" ]; then
  echo "⚠️  HEAD ($(git rev-parse --short HEAD)) ไม่ตรงกับ origin/main ($(git rev-parse --short origin/main))"
  read -r -p "ยัง deploy ต่อไหม? [y/N] " ans
  [ "$ans" = "y" ] || { echo "ยกเลิก"; exit 1; }
fi
echo "▶ deploy $(git log --oneline -1 HEAD) → $VPS_HOST"

git archive --format=tar.gz HEAD server src/data package.json package-lock.json tsconfig.json \
  | ssh -o BatchMode=yes "$VPS_HOST" /usr/local/bin/workpath-deploy deploy "$SHA"

echo "▶ public: $(curl -fsS "$PUBLIC_HEALTH")"
echo "✅ เสร็จ — แจ้งผู้ใช้ให้รีเฟรชหน้าเว็บ 1 ครั้ง"
