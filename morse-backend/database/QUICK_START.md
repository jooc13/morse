# MORSE Database - Quick Start

## 🚀 Deploy to Render (5 Minutes)

### Step 1: Push Code
```bash
git push origin main
```
*Wait 3-5 minutes for deployment*

### Step 2: Initialize Database
```bash
render shell -s morse-api
cd /app/morse-backend/database
./init_database.sh
```

### Step 3: Verify
```bash
./verify_database.sh
```

✅ **Done!** Database is ready.

---

## 🏠 Local Development

### Setup
```bash
export DATABASE_URL="postgresql://localhost:5432/morse_dev"
./init_database.sh --with-test-data
./verify_database.sh
```

### Test Data
Device UUIDs (last 4 chars): `c4b9`, `4c5d`, `bc12`
Test Passphrase: `TestPassword123`

---

## 📋 Common Commands

### Initialize (Idempotent)
```bash
./init_database.sh                 # Production
./init_database.sh --with-test-data  # Development
./init_database.sh --force         # Clean reinstall
```

### Verify Installation
```bash
./verify_database.sh
```

### Emergency Rollback
```bash
./rollback_database.sh --confirm --save-backup
```

### Check Database Status
```bash
psql $DATABASE_URL -c "\dt"        # List tables
psql $DATABASE_URL -c "\df"        # List functions
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

---

## 🔍 Troubleshooting

### Can't Connect
```bash
echo $DATABASE_URL  # Check variable is set
psql $DATABASE_URL -c "SELECT 1;"  # Test connection
```

### Permission Denied
```bash
chmod +x *.sh  # Fix script permissions
```

### Verification Fails
```bash
./verify_database.sh 2>&1 | tee verify.log
cat verify.log  # Review failures
```

---

## 📚 Documentation

- **Full Reference**: `README.md`
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md`
- **Executive Summary**: `/MIGRATION_SUMMARY.md`

---

## 🆘 Emergency Contacts

- Render Docs: https://render.com/docs/databases
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Project Backend: `/morse-backend/README.md`

---

## ✨ What's Inside

**Tables**: 20 (users, workouts, exercises, sessions, teams, etc.)
**Indexes**: 50+ (optimized for performance)
**Functions**: 11 (session management, claiming, voice matching)
**Views**: 2 (summaries and analytics)

**Features**:
- ✅ Idempotent (safe to re-run)
- ✅ Transactional (all-or-nothing)
- ✅ Validated (40+ automated checks)
- ✅ Recoverable (rollback script)
- ✅ Optimized (PostgreSQL-specific indexes)

---

**Need Help?** See full documentation in `README.md` and `DEPLOYMENT_GUIDE.md`
