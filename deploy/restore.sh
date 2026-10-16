#!/bin/sh
# Восстановление из бэкапа. ЗАМЕНЯЕТ текущую базу и файлы содержимым бэкапа.
# Запуск на сервере из папки проекта:  sh deploy/restore.sh 2026-10-20_0300
set -eu
STAMP=${1:?Укажите папку бэкапа, например: sh deploy/restore.sh 2026-10-20_0300  (список: ls backups)}
DIR=backups/$STAMP
[ -f "$DIR/db.dump" ] || { echo "Нет файла $DIR/db.dump"; exit 1; }
C="docker compose -f docker-compose.prod.yml"

printf "Текущая база и файлы будут заменены бэкапом %s. Продолжить? Напишите ДА: " "$STAMP"
read -r ok
[ "$ok" = "ДА" ] || { echo "Отменено"; exit 1; }

$C stop app
$C exec -T backup sh -c 'pg_restore --clean --if-exists --no-owner --dbname=tender' < "$DIR/db.dump"
$C run --rm --no-deps -v "$(pwd)/$DIR:/restore:ro" --entrypoint sh app -c 'rm -rf /app/uploads/* && tar -xzf /restore/uploads.tar.gz -C /app/uploads'
$C start app
echo "Восстановлено из $STAMP"
