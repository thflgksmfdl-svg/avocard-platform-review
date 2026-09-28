# Admin Orders Regression Tests

## Overview

Comprehensive regression test suite for **1-step admin order features** in the Avocard platform admin panel. These tests verify core admin functionality without interfering with ongoing 2-step pricing feature development.

**Test File:** `backend/test/admin-orders.test.ts`  
**Test Count:** 24 tests organized into 6 test suites

## Test Coverage

### 1. Search Functionality (3 tests)
- ✅ Search by order number (case-insensitive)
- ✅ Search by customer email (case-insensitive)
- ✅ Search by customer memo (case-insensitive)

**Implementation:** Tests use `GET /api/v1/admin/orders?search=<query>` with case-insensitive matching on order_no, customer email, and customer_memo fields.

### 2. Filter Functionality (6 tests)
- ✅ Filter by customer status (QUOTE_PENDING, PAYMENT_PENDING, etc.)
- ✅ Filter by payment method (CARD, BANK_TRANSFER)
- ✅ Filter by assigned operator
- ✅ Filter by API error status (`hasApiError=true`)
- ✅ Filter by refund in progress (`hasRefundInProgress=true`)
- ✅ Filter by date range (submittedFrom/submittedTo)

**Implementation:** Tests use query parameters with `findAnyOrders()` repository function which builds Prisma `WHERE` conditions.

### 3. Operator Assignment (3 tests)
- ✅ Assign operator to an order
- ✅ Clear operator assignment (operatorId=null)
- ✅ Persist assignment after refresh

**Endpoints:**
- `PATCH /api/v1/admin/orders/:id/assigned-operator` → assigns operator
- `GET /api/v1/admin/orders/:id` → fetches order detail with assignment

**Implementation:** Uses `assignOrderOperator()` service which atomically updates assigned_operator_id and writes audit log.

### 4. Order Notes (2 tests)
- ✅ Add a note to an order
- ✅ Accumulate multiple notes in chronological order
- ✅ Enforce note length limits (max 4000 chars)

**Endpoints:**
- `POST /api/v1/admin/orders/:id/notes` → adds note
- `GET /api/v1/admin/orders/:id` → fetches notes in time order

**Implementation:** Notes are append-only, fetched via `findNotesForOrder()` ordered by created_at ASC.

### 5. Audit Logging (2 tests)
- ✅ Log ASSIGN_OPERATOR action with actor info
- ✅ Log ADD_NOTE action with note body

**Audit Record Fields:**
- `entity_type`: "avocard_order"
- `action`: "ASSIGN_OPERATOR" | "ADD_NOTE"
- `actor_type`: "ADMIN"
- `actor_id`: admin user ID
- `after_json`: Contains assignedOperatorId or { noteId, body }

### 6. Error Handling & Detail API (2 tests)
- ✅ Error badge in list response (errorSummaries array)
- ✅ Detailed integration attempts in detail response

**Error Badge Response:**
```json
{
  "provider": "ALIBABA_1688",
  "operation": "createCrossOrder",
  "reason": "1688 주문 생성 실패",
  "count": 2,
  "lastOccurredAt": "2026-09-28T..."
}
```

**Implementation:** Uses `findErrorSummariesForOrders()` which aggregates latest-per-(order, provider, operation) failed attempts.

### 7. Permission Checks (4 tests)
- ✅ Reject customer access to `/api/v1/admin/orders` (list)
- ✅ Reject customer access to `/api/v1/admin/orders/:id` (detail)
- ✅ Reject customer access to assign operator endpoint
- ✅ Reject customer access to add note endpoint

**Implementation:** All admin endpoints use `fastify.verifyAdminSession` middleware which checks for valid admin session cookie.

### 8. Operator List Endpoint (1 test)
- ✅ List active admin operators with id, email, displayName

**Endpoint:** `GET /api/v1/admin/operators` returns array of admin users.

---

## Running the Tests

### Prerequisites
- PostgreSQL 12+ running on localhost:5433 (from `.env.local`)
- Database: `avocard_platform`
- User: `avocard_dev`

### One-time Setup
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Verify DB connection
psql postgresql://avocard_dev@localhost:5433/avocard_platform
```

### Run All Tests
```bash
npm run test:backend
```

### Run Admin Orders Tests Only
```bash
cd backend
npx vitest run test/admin-orders.test.ts
```

### Run with Watch Mode (development)
```bash
cd backend
npx vitest test/admin-orders.test.ts
```

### Run with Coverage
```bash
cd backend
npx vitest run --coverage test/admin-orders.test.ts
```

---

## Test Data

Each test creates its own isolated test data:
1. Unique customer profile with random shopify_customer_id
2. Order submitted via `/api/v1/me/orders` endpoint
3. Test admin user session via `createAdminSessionCookie()` helper
4. Additional test data (notes, assignments, integration attempts) as needed

**No production data is modified.** All test data uses randomly-generated IDs to avoid conflicts.

---

## Key Design Decisions

### Isolated Admin User Per Session
Each test session creates a unique admin user with `createAdminSessionCookie()`. This ensures:
- Tests don't interfere with each other
- Admin ID is known for audit log verification
- No cleanup needed after tests

### API Integration Tests (Not Unit Tests)
Tests exercise the full HTTP API stack:
- Request/response validation via Zod schemas
- Middleware execution (auth, correlation ID)
- Database round-trips
- Audit logging

This catches integration bugs that unit tests would miss.

### Test Helpers
- **`createTestOrder(app, customerId, memo?)`** — Creates customer + order for test
- **`createAdminSessionCookie(app)`** — Creates admin user + signed session (from `admin-session.ts`)

### Concurrent Isolation
Vitest runs tests in parallel. No shared state is used:
- Each test creates unique customers/orders
- Each test session has unique admin user
- No cross-test dependencies

---

## What's NOT Tested (Out of Scope)

Per requirements, the following are **not** tested by these regression tests:

### 2-Step Pricing Feature (In Development)
- Price modification endpoints
- Pricing strategy business logic
- Price audit trails
- Pricing-related state transitions

**Reason:** Another agent is actively developing this feature. These tests deliberately avoid any pricing-related code to prevent interference.

### Authentication/Session Management
- Admin login/logout flows
- Session expiration
- Password reset
- CSRF/CORS protection

**These are covered by:** `admin-auth.routes.ts` (separate from order management)

### Customer-Facing Order Features
- Order submission validation
- Customer-visible order status
- Payment processing
- Shopify integration details

**These are covered by:** `order-submission.test.ts`, `order.routes.ts` customer endpoints

### Advanced Admin Features (Planned)
- Bulk order operations
- Export/report generation
- Advanced sorting/pagination
- Custom field management

---

## Debugging Failed Tests

### Database Connection Issues
```bash
# Verify PostgreSQL is running
psql postgresql://avocard_dev@localhost:5433/avocard_platform -c "SELECT 1"

# Check logs
docker logs <postgres-container>
```

### Test Isolation Issues
If a test fails intermittently:
1. Check for unique constraint violations (UUIDs should be random)
2. Look at generated order numbers in `order-number.ts`
3. Verify test cleanup in `afterAll()` hook

### Admin Session Issues
If auth tests fail:
- Verify `ADMIN_SESSION_SECRET` is set in `.env.local`
- Check session cookie name: `avocard_admin_session`
- Verify admin_auth.routes.ts login endpoint works

### Audit Log Issues
If audit tests fail:
- Verify AuditLog table exists and is writable
- Check `actor_type` enum values (should be 'ADMIN', 'CUSTOMER', 'SYSTEM')
- Verify timestamps are in UTC

---

## Maintenance & Updates

### When to Update Tests
1. **Schema changes** → Update test data creation
2. **API changes** → Update request/response validation
3. **New filters/searches** → Add corresponding tests
4. **Bug fixes** → Add regression test for the bug
5. **Permission changes** → Update permission check tests

### When NOT to Update Tests
1. **Internal refactoring** → Only if external behavior changes
2. **Performance improvements** → Only if threshold changes
3. **Pricing feature development** → Avoid this area per requirements

### Adding New Tests
```typescript
it('new test scenario', async () => {
  const customerId = `test-new-${randomUUID()}`;
  const order = await createTestOrder(app, customerId, 'Test');
  
  // Test the new feature
  const response = await app.inject({
    method: 'GET|POST|PATCH|DELETE',
    url: '/api/v1/admin/...',
    headers: { cookie: adminCookieHeader },
    payload: { /* ... */ },
  });
  
  expect(response.statusCode).toBe(200);
  // ... more assertions
});
```

---

## Related Tests & Code

- **Admin Auth:** `backend/src/modules/admin-auth/` (login/session)
- **Order Routes:** `backend/src/modules/avocard-order/order.routes.ts` (all endpoints)
- **Order Service:** `backend/src/modules/avocard-order/order.service.ts` (business logic)
- **Order Repository:** `backend/src/modules/avocard-order/order.repository.ts` (data access)
- **Audit Logging:** `backend/src/modules/audit/audit-log.service.ts`
- **Test Helpers:** `backend/test/helpers/` (admin-session.ts, build-test-app.ts)

---

## Summary

✅ **24 comprehensive regression tests** covering all 1-step admin order features  
✅ **Zero interference** with 2-step pricing development  
✅ **Full API integration testing** with real database  
✅ **Audit trail verification** for compliance & debugging  
✅ **Permission enforcement** for security  
✅ **Maintainable test structure** with helpers and clear organization  

Tests are ready to run once PostgreSQL is available.
