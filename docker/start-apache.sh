#!/bin/sh
set -eu

: "${PORT:=10000}"
: "${MIGRATE_ON_START:=1}"
: "${SEED_ADMIN_ON_START:=0}"
: "${SEED_DASHBOARD_USERS_ON_START:=0}"

sed -i "s/^Listen .*/Listen ${PORT}/" /etc/apache2/ports.conf
sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

if [ "${MIGRATE_ON_START}" = "1" ]; then
    php /app/bin/migrate.php
fi

# Fail closed when the encryption key is missing or legacy plaintext banking
# fields cannot be converted safely.
php /app/bin/encrypt-onboarding-bank-data.php

if [ "${SEED_DASHBOARD_USERS_ON_START}" = "1" ]; then
    php /app/bin/seed-dashboard-users.php
elif [ "${SEED_ADMIN_ON_START}" = "1" ]; then
    php /app/bin/seed-admin.php
fi

if [ "${HRMS_EMAIL_NOTIFICATIONS:-0}" = "1" ] && [ -n "${SENDERKIT_API_KEY:-}" ]; then
    (
        while true; do
            php /app/bin/send-notification-emails.php || true
            sleep 30
        done
    ) &
fi

exec apache2-foreground
