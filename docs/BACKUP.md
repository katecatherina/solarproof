# Database Backup & Restore

Daily `pg_dump` backups of the Supabase Postgres database are uploaded to S3 and retained for 30 days. Backups run at **02:00 UTC** via GitHub Actions.

---

## Setup

### 1. Create an S3 bucket

```bash
aws s3api create-bucket --bucket solarproof-backups --region us-east-1
# Enable versioning (optional but recommended)
aws s3api put-bucket-versioning \
  --bucket solarproof-backups \
  --versioning-configuration Status=Enabled
```

### 2. Create an IAM user with minimal permissions

Attach a policy that allows only `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, and `s3:ListBucket` on the backup bucket.

### 3. Add GitHub secrets and variables

| Name | Type | Value |
|---|---|---|
| `SUPABASE_DB_URL` | Secret | Supabase direct connection string (`postgresql://...`) |
| `BACKUP_AWS_ACCESS_KEY_ID` | Secret | IAM access key |
| `BACKUP_AWS_SECRET_ACCESS_KEY` | Secret | IAM secret key |
| `BACKUP_S3_BUCKET` | Variable | `solarproof-backups` |
| `BACKUP_AWS_REGION` | Variable | `us-east-1` |
| `SLACK_BACKUP_WEBHOOK` | Secret | Slack incoming webhook URL (for failure alerts) |

The Supabase direct connection string is found in the Supabase dashboard under **Project Settings → Database → Connection string → URI** (use the direct connection, not the pooler).

---

## Manual backup

```bash
export DATABASE_URL="postgresql://..."
export S3_BUCKET="solarproof-backups"
export AWS_ACCESS_KEY_ID="..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_DEFAULT_REGION="us-east-1"

bash scripts/backup-db.sh
```

---

## Restore procedure

### 1. Download the backup

```bash
# List available backups
aws s3 ls s3://solarproof-backups/backups/

# Download a specific backup
aws s3 cp s3://solarproof-backups/backups/solarproof-backup-<TIMESTAMP>.dump ./restore.dump
```

### 2. Verify the backup archive

Before restoring, validate the downloaded archive to catch corruption early.

```bash
file restore.dump
pg_restore --list restore.dump | head -n 20
```

If `pg_restore --list` fails, the archive is invalid and should not be restored.

### 3. Restore to a target database

```bash
pg_restore \
  --format=custom \
  --no-acl \
  --no-owner \
  --clean \
  --if-exists \
  -d "$TARGET_DATABASE_URL" \
  restore.dump
```

> ⚠️ `--clean --if-exists` drops existing objects before restoring. Run against a staging database first to validate the backup before touching production.

### 4. Verify the restored database

```bash
psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM readings;"
psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM certificates;"
psql "$TARGET_DATABASE_URL" -c "SELECT COUNT(*) FROM meters;"
```

Compare restored row counts and schema to a known-good environment before promoting the restored database into production.

> Tip: If you have production counts available, compare them with the staging restore results to ensure the archive contains the expected data.

---

## Retention

The backup script automatically deletes objects older than 30 days from the `backups/` prefix after each successful upload.

---

## Failure alerts

If the backup fails (pg_dump error or S3 upload error), a Slack message is sent to the webhook configured in `SLACK_BACKUP_WEBHOOK`. The GitHub Actions job also fails visibly in the Actions tab.
