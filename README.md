# AVOCARD Platform

1688 구매대행 + 중판 배송대행 통합을 위한 신규 백엔드/어드민. 기존 Shopify 테마(`Avocard/` 상위 폴더)는 그대로 유지되며, 여기 `platform/` 아래에서만 개발한다.

세부 요구사항은 `docs/agent-handoff/AVOCARD_AGENT_HANDOFF/00_README.md`부터 번호순으로 읽을 것. 현재 구현 범위와 미구현 항목은 `docs/agent-handoff/AVOCARD_AGENT_HANDOFF/08_OPEN_QUESTIONS_AND_BLOCKERS.md`를 참고.

## 구성

- `backend/` — Node.js + TypeScript + Fastify + PostgreSQL + Prisma. 모듈형 모놀리스.
- `admin/` — React + TypeScript + Vite SPA. 운영자 전용, backend REST API와 통신.
- `storefront/` — 비어 있음. 기존 Shopify 테마와의 연결은 이번 slice 범위 밖.

## 최초 설정

```powershell
# 1) 루트에서 전체 workspace 설치 (한 번만)
cd platform
npm install

# 2) backend 환경변수 설정
#    backend/.env.local 을 열어 실제 값을 채운다 (DATABASE_URL 필수).
#    이 파일은 git에 커밋되지 않는다.

# 3) DB 마이그레이션 (로컬 PostgreSQL 필요)
npm run prisma:migrate -w backend -- --name init

# 4) (선택) 개발용 관리자 계정 + 초기 환율 시드
npm run -w backend prisma:seed
```

시드 스크립트는 `admin@avocard.local` / `dev-only-password` 관리자 계정을 만든다. **개발 전용**이며 운영에서는 사용하지 않는다.

## 개발 서버 실행

```powershell
# 터미널 1: backend (http://localhost:4000)
npm run dev:backend

# 터미널 2: admin (http://localhost:5173)
npm run dev:admin
```

## 테스트

```powershell
npm run test:backend
```

- `test/env-guard.test.ts`는 DB 없이 실행 가능하다 (운영환경 Shopify 인증 stub 차단 로직 검증).
- 나머지 테스트(`health`, `customer-profile`, `address-book`, `exchange-rate`, `order-submission`)는 `DATABASE_URL`이 가리키는 실제 PostgreSQL이 필요하다.

## 고객 인증 (개발 전용 stub)

`SHOPIFY_AUTH_MODE=dev-stub`일 때만, `/api/v1/me/*` 라우트는 `X-Dev-Shopify-Customer-Id` 헤더를 그대로 신뢰한다. **운영환경(`NODE_ENV=production`)에서는 이 stub이 코드 레벨에서 두 군데(`config/env.ts` boot-time 검증, `app.ts` 어댑터 조립부)에서 차단된다.** 실제 Shopify 고객 세션 검증 방식은 아직 미확정 — `08_OPEN_QUESTIONS_AND_BLOCKERS.md` P0-24 참고.

## 중판(Jungpan) / 1688 연동

이번 slice에서는 실제 외부 API 호출이 없다. `src/integrations/*/*.adapter.stub.ts`는 모두 `NotImplementedError`를 던진다.

중판 API credential(`JUNGPAN_BASE_URL`, `JUNGPAN_SITE_CD`, `JUNGPAN_API_KEY`)이 `backend/.env.local`에 채워지면:
1. `src/integrations/jungpan/jungpan.port.ts`의 **읽기(GET) 메서드부터** 실제 구현하고 테스트 서버에서 검증한다.
2. `createOrder`, `notifyPayment` 등 쓰기(POST) 메서드는 실행 대상과 영향(테스트 서버에 실제 데이터가 생성됨)을 확인한 뒤 별도로 진행한다.

## 알려진 제약 / 다음 단계

`08_OPEN_QUESTIONS_AND_BLOCKERS.md`의 22~25번 항목 및 P0-6 참조. 요약:
- 중판 API 원본 가이드/테스트 서버 정보는 저장소에 없음 — 사용자가 별도 전달 예정.
- Shopify 고객 세션의 운영용 검증 방식(Storefront API 토큰 교환 vs App Proxy) 미확정.
- 이번 slice는 결제/예치금/1688/중판 실연동/알림을 포함하지 않는다 — `C:\Users\Qeen\.claude\plans\twinkly-jingling-valiant.md` §7 참조.
