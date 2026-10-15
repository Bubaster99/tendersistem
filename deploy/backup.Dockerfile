# Контейнер бэкапов: pg_dump той же версии, что и база, + rclone для копии в облачное хранилище.
FROM postgres:16-alpine
RUN apk add --no-cache rclone tzdata
COPY deploy/backup.sh /backup.sh
# Каждый день в 03:00 по Москве.
RUN echo '0 3 * * * sh /backup.sh >> /backups/backup.log 2>&1' | crontab -
ENV TZ=Europe/Moscow
ENTRYPOINT ["sh", "-c", "echo 'Бэкапы: каждый день в 03:00 (мск), папка backups/' && crond -f -l 8"]
