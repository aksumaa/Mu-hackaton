#!/bin/sh
set -eu
npx prisma migrate deploy
exec npm run start -- --hostname 0.0.0.0 --port 3000
