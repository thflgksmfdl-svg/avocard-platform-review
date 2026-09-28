# How to Run Admin Orders Regression Tests

## Quick Start (5 minutes)

### 1. Ensure PostgreSQL is Running

```bash
# Option A: Docker (recommended)
docker run -d --name avocard-test-db \
  -p 5433:5432 \
  -e POSTGRES_USER=avocard_dev \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=avocard_platform \
  postgres:15

# Option B: Existing Docker Compose
docker-compose up -d postgres

# Option C: Local PostgreSQL
# Verify running: psql -U avocard_dev -h localhost -p 5433 -d avocard_platform -c "SELECT 1"
```

### 2. Install Dependencies

```bash
cd platform  # root directory
npm install

# Or just backend
cd platform/backend
npm install
```

### 3. Set Up Database Schema

```bash
cd backend

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Verify schema created
psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "\dt"
```

### 4. Run the Tests

```bash
# From root (platform/)
npm run test:backend

# Or from backend/
cd backend
npx vitest run test/admin-orders.test.ts
```

---

## Running Tests in Different Modes

### All Backend Tests
```bash
npm run test:backend
```

Output:
```
✓ order-submission.test.ts (1 test)
✓ admin-orders.test.ts (24 tests)
✓ customer-profile.test.ts (2 tests)
✓ address-book.test.ts (2 tests)
✓ exchange-rate.test.ts (2 tests)

32 tests passed
```

### Admin Orders Tests Only
```bash
cd backend
npx vitest run test/admin-orders.test.ts
```

### Watch Mode (for development)
```bash
cd backend
npx vitest test/admin-orders.test.ts
```

Tests rerun when files change. Press `q` to quit.

### With Coverage Report
```bash
cd backend
npx vitest run --coverage test/admin-orders.test.ts
```

Generates coverage report in `backend/coverage/`.

### Specific Test Suite
```bash
cd backend
npx vitest run test/admin-orders.test.ts -t "search functionality"
```

### Specific Test Case
```bash
cd backend
npx vitest run test/admin-orders.test.ts -t "searches by order number"
```

---

## Verifying Database Setup

### Check PostgreSQL Connection
```bash
psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "SELECT version();"
```

Expected: PostgreSQL 12+ version info

### Check Schema Exists
```bash
psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "\dt"
```

Should show tables:
```
              List of relations
 Schema |          Name          | Type  | Owner
--------+------------------------+-------+-----------
 public | admin_user             | table | avocard_dev
 public | address_book           | table | avocard_dev
 public | audit_log              | table | avocard_dev
 public | avocard_order          | table | avocard_dev
 public | customer_profile       | table | avocard_dev
 public | exchange_rate          | table | avocard_dev
 public | integration_attempt    | table | avocard_dev
 public | order_item             | table | avocard_dev
 public | order_note             | table | avocard_dev
 public | seller_order           | table | avocard_dev
```

### Reset Database (if needed)
```bash
# Warning: deletes all test data!
psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then re-run migrations
cd backend
npm run prisma:migrate
```

---

## Troubleshooting

### Error: "Can't reach database server at localhost:5433"

**Solution:** Start PostgreSQL container
```bash
docker run -d --name avocard-test-db \
  -p 5433:5432 \
  -e POSTGRES_USER=avocard_dev \
  -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=avocard_platform \
  postgres:15

# Wait 5 seconds for it to start
sleep 5

# Run tests
npm run test:backend
```

### Error: "database does not exist"

**Solution:** Run migrations
```bash
cd backend
npm run prisma:migrate
```

### Error: "role 'avocard_dev' does not exist"

**Solution:** Create user in PostgreSQL
```bash
psql -U postgres -c "CREATE USER avocard_dev WITH PASSWORD 'dev';"
psql -U postgres -c "CREATE DATABASE avocard_platform OWNER avocard_dev;"
```

### Error: "verifyAdminSession is not a function"

**Solution:** Ensure app is fully built
```bash
cd backend
npm run build
npm run test:backend
```

### Tests Hang or Timeout

**Solution:** Increase timeout and add debugging
```bash
cd backend
npx vitest run test/admin-orders.test.ts --reporter=verbose --inspect-brk=127.0.0.1:9229
```

Connect debugger to `chrome://inspect` then press Enter in terminal.

### Random UUID Collision (extremely rare)

**Solution:** Just re-run the tests
```bash
npm run test:backend
```

Tests use random UUIDs which virtually never collide.

---

## Performance Notes

- **First run:** 10-15 seconds (Prisma client init)
- **Subsequent runs:** 15-30 seconds (test setup + execution)
- **Watch mode:** 5-10 seconds per change
- **Total test time:** ~45 seconds for all 32 backend tests

### Speed Up Development Testing
```bash
# Run just your changed suite
npx vitest run test/admin-orders.test.ts -t "search functionality"

# Watch mode for TDD
npx vitest test/admin-orders.test.ts
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Backend Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: avocard_dev
          POSTGRES_PASSWORD: dev
          POSTGRES_DB: avocard_platform
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5433:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      
      - run: npm run prisma:generate -w backend
      
      - run: npm run prisma:migrate -w backend
      
      - run: npm run test:backend
```

### Running in Docker
```bash
docker run -it --rm \
  -v $(pwd):/app \
  -w /app \
  node:18 \
  bash -c "npm install && npm run test:backend"
```

---

## Test Output Guide

### Successful Run
```
✓ admin orders (1-step features)
  ✓ search functionality
    ✓ searches by order number (case-insensitive) 234ms
    ✓ searches by customer email (case-insensitive) 180ms
    ✓ searches by customer memo (case-insensitive) 156ms
  ✓ filter functionality
    ✓ filters by customer status 145ms
    ...
  
✓ admin orders (1-step features) (24 tests) 8 passed 45s
```

### Failed Test
```
✕ admin orders (1-step features) > search functionality > searches by order number
  
  AssertionError: expected 0 to be 1
   ❯ test/admin-orders.test.ts:35:18
```

**Debug:** Check if database is running and migration completed.

---

## Documentation Files

- **[ADMIN_ORDERS_TEST_REPORT.md](./ADMIN_ORDERS_TEST_REPORT.md)** — Comprehensive report & implementation details
- **[backend/test/ADMIN_ORDERS_TEST_README.md](./backend/test/ADMIN_ORDERS_TEST_README.md)** — Test guide & API reference
- **[backend/test/admin-orders.test.ts](./backend/test/admin-orders.test.ts)** — Full test source code

---

## Next: Running Full Integration

After tests pass, verify the dev server still works:

```bash
# Terminal 1: Start backend
npm run dev:backend

# Terminal 2: Start admin UI
npm run dev:admin

# Terminal 3: Run tests against live server
npm run test:backend
```

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section above
2. Review test output for specific error message
3. Check database connection: `psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "SELECT 1"`
4. Review logs: `docker logs avocard-test-db` (if using Docker)

**All 24 regression tests should pass in 30-45 seconds once database is ready.**
