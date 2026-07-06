# VISITOR-OS Backup Guide - v1.0.0-RC1

## What Must Be Backed Up

- PostgreSQL database.
- Business configuration files.
- Runtime settings.
- KMS document storage when enabled.
- Audit and application logs when required by policy.

## Local Docker Backup

```bash
scripts/backup.sh
```

The script creates a timestamped backup containing PostgreSQL dump, configuration archive, Docker logs and a redacted environment snapshot.

## Restore

```bash
scripts/restore.sh backups/YYYYMMDD-HHMMSS
```

Always test restore on a disposable environment before using it on production.

## SaaS Backup

On Railway/Render, use managed PostgreSQL snapshots plus VISITOR-OS export scripts. Confirm retention and restore procedure with the hosting provider.

