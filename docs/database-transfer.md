# Moving the database between local and Neon

Neon is plain Postgres, so `pg_dump` / `pg_restore` do the job. The local
database lives in the `postgres18` Docker container (role `poketrain`,
database `poketrain_dev`), so the commands below run the Postgres tools
**inside the container** (`docker exec`). That guarantees the client version
matches the local server and means nothing has to be installed on the host.

Dumps are written to and read from the host with shell redirection, so no
files are left inside the container.

> **Restoring overwrites the target.** `--clean --if-exists` drops each object
> before recreating it. Make a dump of the target first if its data matters.

## Setup

Get the connection strings once and keep them in shell variables (do not
commit them):

```bash
# Neon console > Connect. Use the DIRECT connection (host without "-pooler"):
# pg_dump / pg_restore can fail through the pooler.
export NEON_URL='postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/neondb?sslmode=require'

# Local (matches scripts/setup-db.sh and .env.local)
export LOCAL_CONTAINER=postgres18
export LOCAL_USER=poketrain
export LOCAL_DB=poketrain_dev
```

The app itself can use the pooled Neon URL at runtime; the direct URL is for
dumps, restores and `prisma migrate`.

## Local → Neon

```bash
# 1. Dump local (custom format, no owners/grants: the local role does not exist on Neon)
docker exec "$LOCAL_CONTAINER" pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --format=custom --no-owner --no-privileges \
  > poke_train_local.dump

# 2. Restore into Neon (docker -i feeds the file on stdin)
docker run --rm -i postgres:18 pg_restore \
  --no-owner --no-privileges --clean --if-exists \
  -d "$NEON_URL" \
  < poke_train_local.dump
```

Step 2 uses a throwaway `postgres:18` container so nothing needs installing on
the host. Any `pg_restore` of version 18 or newer works, including a host
install:

```bash
pg_restore --no-owner --no-privileges --clean --if-exists -d "$NEON_URL" poke_train_local.dump
```

## Neon → Local

```bash
# 1. Dump Neon
docker run --rm postgres:18 pg_dump "$NEON_URL" \
  --format=custom --no-owner --no-privileges \
  > poke_train_neon.dump

# 2. Restore into the local container
docker exec -i "$LOCAL_CONTAINER" pg_restore -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --no-owner --no-privileges --clean --if-exists \
  < poke_train_neon.dump
```

Objects restored this way are owned by `poketrain` because `--no-owner` makes
them belong to the user running the restore.

## Plain SQL variant (easy to inspect or edit)

```bash
# dump
docker exec "$LOCAL_CONTAINER" pg_dump -U "$LOCAL_USER" -d "$LOCAL_DB" \
  --no-owner --no-privileges --clean --if-exists > poke_train.sql

# restore to Neon
docker run --rm -i postgres:18 psql "$NEON_URL" -v ON_ERROR_STOP=1 < poke_train.sql

# restore to local
docker exec -i "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" -v ON_ERROR_STOP=1 < poke_train.sql
```

## Check it worked

Compare row counts on a few tables between both sides:

```bash
docker exec "$LOCAL_CONTAINER" psql -U "$LOCAL_USER" -d "$LOCAL_DB" -c '\dt'
docker run --rm postgres:18 psql "$NEON_URL" -c '\dt'
```

Then point `DATABASE_URL` in `.env.local` (or the hosting env vars) at the
database you want the app to use and run `npm run dev`.

## Troubleshooting

- **Version error from `pg_dump`** ("server version mismatch"): the client must
  be the same major version as the server or newer. Use the `postgres:18`
  image above, or match Neon's version with `postgres:<version>`.
- **Permission errors on `CREATE EXTENSION`**: create the extension manually on
  the target first (`CREATE EXTENSION IF NOT EXISTS ...;`), then re-run.
- **Errors about missing roles**: you dropped `--no-owner` / `--no-privileges`.
- **Restore warnings about objects that do not exist**: expected on the first
  restore with `--clean`; `--if-exists` keeps them harmless.
- **Dump files contain your data**: do not commit them. Delete them when done.
