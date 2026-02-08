# Backend Changes (current session)

This file summarizes the **minimal, necessary backend updates** made in this pass, focused on safety and clarity without changing API behavior.

## 1. Shared database pool for legacy company endpoints

**Files updated**:
- `src/controllers/companyController-db.ts`
- `src/controllers/metaController.ts`
- `src/controllers/contractorUpdateController.ts`

**What changed**:
- These controllers previously created their own `pg.Pool` instances using `config.database`.
- They now import and use the shared pool from `src/config/database.ts`:
  - `import pool from '../config/database';`

**Why**:
- Avoids multiple connection pools with the same configuration.
- Centralizes database connection settings and lifecycle in one place.
- Aligns older controllers with the pattern already used by auth, chat, and GC dashboard code.

## 2. Swagger now includes GC Dashboard controllers

**File updated**:
- `src/swagger.ts`

**What changed**:
- Extended the Swagger `apis` glob so it picks up GC Dashboard controller documentation:

  - Before:
    - `apis: ['./src/routes/*.ts', './src/controllers/*.ts'],`
  - After:
    - `apis: ['./src/routes/*.ts', './src/controllers/*.ts', './src/controllers/gcDashboard/*.ts'],`

**Why**:
- GC Dashboard endpoints under `/api/gc-dashboard/...` now appear in the Swagger UI.
- Keeps API docs in sync with the actual backend features used by the GC frontend.

## 3. SMS service uses centralized config

**File updated**:
- `src/services/smsService.ts`

**What changed**:
- Twilio client and phone number now read from `config.sms` instead of `process.env` directly:
  - Client creation:
    - Before: `twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)`
    - After: `twilio(config.sms.accountSid, config.sms.authToken)`
  - Sender number:
    - Before: `from: process.env.TWILIO_PHONE_NUMBER`
    - After: `from: config.sms.phoneNumber`

**Why**:
- Centralizes all SMS/Twilio configuration under `config/index.ts`.
- Matches the pattern used by email configuration.
- Makes it easier to manage and override SMS settings per environment.

---

## 4. Consolidated email sending into emailService

**Files updated**:
- `src/services/emailService.ts`
- `src/controllers/authController.ts`
- `src/controllers/emailController.ts`
- `src/utils/email.ts` (removed; logic moved to service)

**What changed**:
- Centralized verification-link and password-reset email templates in `emailService` using the shared `sendEmail` helper.
- Updated auth and email controllers to call the service instead of a separate `utils/email` module.
- Removed the old `utils/email.ts` implementation to eliminate duplicate, divergent email-sending code.

**Why**:
- Keeps all outbound email behavior in a single, testable service.
- Reduces confusion between different `sendVerificationEmail` implementations.
- Makes it easier to harden logging and templates in one place for future security work.

These updates are intentionally small and low-risk: they tighten internal structure and documentation without changing the public API contracts expected by your frontend.
