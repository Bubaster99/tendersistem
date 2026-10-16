#!/bin/sh
# Бэкап базы и загруженных файлов. Запускается контейнером backup каждый день в 03:00 (мск).
# Результат: backups/ГГГГ-ММ-ДД_ЧЧММ/{db.dump, uploads.tar.gz}. Старше BACKUP_KEEP_DAYS дней — удаляются.
set -eu
STAMP=$(date +%Y-%m-%d_%H%M)
DIR=/backups/$STAMP
KEEP=${BACKUP_KEEP_DAYS:-14}
mkdir -p "$DIR"

echo "[$(date)] Бэкап $STAMP: база..."
pg_dump --format=custom --file="$DIR/db.dump"
echo "[$(date)] Бэкап $STAMP: файлы..."
tar -czf "$DIR/uploads.tar.gz" -C /uploads .

# Копия в облачное хранилище (S3-совместимое, в РФ) — если заполнены настройки в .env.
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  export RCLONE_CONFIG_S3_TYPE=s3 RCLONE_CONFIG_S3_PROVIDER=Other \
    RCLONE_CONFIG_S3_ENDPOINT="$BACKUP_S3_ENDPOINT" RCLONE_CONFIG_S3_REGION="${BACKUP_S3_REGION:-ru-1}" \
    RCLONE_CONFIG_S3_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" RCLONE_CONFIG_S3_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY"
  rclone copy "$DIR" "s3:$BACKUP_S3_BUCKET/$STAMP"
  rclone delete "s3:$BACKUP_S3_BUCKET" --min-age "${KEEP}d" && rclone rmdirs "s3:$BACKUP_S3_BUCKET" --leave-root || true
  echo "[$(date)] Копия в облаке: $BACKUP_S3_BUCKET/$STAMP"
fi

find /backups -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP" -exec rm -rf {} +
echo "[$(date)] Готово: $DIR ($(du -sh "$DIR" | cut -f1))"
