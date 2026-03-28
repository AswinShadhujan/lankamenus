# Phase 0 — Implementation Guide

How to implement **Phase 0 — Foundation & quick fixes** in this project. Tasks are listed in **dependency order**; implement in this order.

---

## Task order (summary)

| Order | Task   | What to do |
|-------|--------|------------|
| **1** | 0.1 | Fix `DELETE /restaurants/:id` so it calls the service and returns 204; handle not-found with 404. |
| **2** | 0.2 | Add `.env.example` in `services/api/` documenting required env vars. |
| **3** | 0.3 | Validate env at startup (require `JWT_SECRET`, `DATABASE_URL`, `PORT`); remove `'supersecret'` fallback. |
| **4** | 0.4 | Enable global `ValidationPipe` and add class-validator to auth and search DTOs. |
| **5** | 0.5 | Add `GET /health` returning `{ "status": "ok" }` (optional: DB ping). |

---

## 0.1 — Fix `DELETE /restaurants/:id`

**Goal:** The controller currently returns a message and never deletes. It must call the service, return 204 on success, and 404 when the restaurant does not exist.

**Files to change**

- `services/api/src/restaurants/restaurants.controller.ts`
- `services/api/src/restaurants/restaurants.service.ts` (optional: throw `NotFoundException` so controller can stay thin)

**Steps**

1. **Controller:** Call `this.restaurantsService.delete(id)`, and return nothing with status 204 (NestJS sends 204 when the handler returns nothing or `undefined`). Use proper decorator indentation (the current `@Delete` block has broken indentation).
2. **Service:** In `delete(id)`, if the restaurant does not exist, Prisma throws `PrismaClientKnownRequestError` with code `P2025`. Catch it and throw NestJS `NotFoundException` so the API returns 404. Alternatively, use `findUnique` then delete and throw `NotFoundException` if not found.

**Controller change (conceptual):**

- Replace the current `deleteRestaurant` body with:
  - `await this.restaurantsService.delete(id);` and return nothing (Nest will send 204).
- Fix the decorator indentation so `@Delete(':id')`, `@Roles`, `@UseGuards`, and the method are aligned.

**Service change (conceptual):**

- In `delete(id)`: wrap `this.prisma.restaurants.delete({ where: { id } })` in try/catch.
- On `PrismaClientKnownRequestError` with code `'P2025'`, throw `new NotFoundException('Restaurant not found')`.
- Re-throw other errors so the global exception layer can handle them later.

---

## 0.2 — Add `.env.example`

**Goal:** Document required environment variables so developers and deployment know what to set.

**File to create**

- `services/api/.env.example`

**Content (minimum):**

```env
# Database (required)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"

# API (required)
PORT=3001

# Auth (required in production)
JWT_SECRET="your-secret-at-least-32-chars"
```

**Notes**

- Do not commit real secrets. `.env` should remain in `.gitignore` (it usually is for Nest/Node).
- In README or deploy docs, point to this file for local and production setup.

---

## 0.3 — Env validation at startup

**Goal:** Fail fast if `JWT_SECRET`, `DATABASE_URL`, or `PORT` are missing. Remove the hardcoded `'supersecret'` fallback in `AuthModule`.

**Options**

- **Option A — Joi (recommended with ConfigModule):** Use `ConfigModule.forRoot({ validate: (config) => Joi.object({ ... }).validate(config) })` and validate required keys. If validation fails, throw so the app does not start.
- **Option B — Custom validation:** After `ConfigModule.forRoot()`, in `main.ts` or a dedicated config factory, read `process.env` and throw an error if any of `JWT_SECRET`, `DATABASE_URL`, `PORT` are missing or invalid.

**Files to change**

- `services/api/package.json` — add dependency: `joi` (if using Joi).
- `services/api/src/app.module.ts` — add validation in `ConfigModule.forRoot()` (e.g. `validate` with Joi schema requiring `DATABASE_URL`, `PORT`, `JWT_SECRET`).
- `services/api/src/auth/auth.module.ts` — remove the fallback: use `process.env.JWT_SECRET` only (or inject `ConfigService` and `configService.get<string>('JWT_SECRET')`). The app will already have failed at startup if it’s missing.

**Joi schema example (in app.module or a separate config file):**

- Require `DATABASE_URL` (string, non-empty), `PORT` (number or string that parses to number), `JWT_SECRET` (string, min length e.g. 16 or 32).
- In `ConfigModule.forRoot({ validate: (config) => schema.validate(config, { abortEarly: true }) })`, throw or return validated config so Nest uses it.

**Result:** If any required env var is missing, the app exits on startup with a clear error.

---

## 0.4 — Global ValidationPipe + DTOs

**Goal:** Enable Nest’s `ValidationPipe` globally and validate auth and search DTOs with class-validator so invalid bodies/queries are rejected with 400.

**Steps**

1. **Install packages** (in `services/api`):
   - `class-validator`
   - `class-transformer` (required by Nest for ValidationPipe to transform plain objects to DTO instances)

2. **Enable ValidationPipe in `main.ts`:**
   - After `NestFactory.create(AppModule)`, add:
     - `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));`
     - Or at least `whitelist: true` to strip unknown properties. Use `forbidNonWhitelisted: true` if you want 400 on extra properties.

3. **Auth DTOs:** Create DTO classes and use them in the auth controller.
   - Create `services/api/src/auth/dto/register.dto.ts` with class-validator decorators: `IsEmail`, `IsString`, `MinLength` for password, optional `IsString` for name.
   - Create `services/api/src/auth/dto/login.dto.ts`: `IsEmail`, `IsString`, `MinLength` for password.
   - In `AuthController`, replace inline body types with `@Body() body: RegisterDto` and `LoginDto`.

4. **Search DTO:** Add class-validator to `SearchRestaurantsDto`.
   - Optional but useful: `IsOptional()`, `IsString()` on string fields; `IsIn(['true','false'])` for `veg` and `halal`; `IsInt()`, `Min(1)`, `Max(100)` for `page` and `pagesize` (if you use `@Type(() => Number)` or keep as string and validate in service). At minimum, add `@IsOptional()` and type decorators so the pipe can validate when query params are present.

**Files to create**

- `services/api/src/auth/dto/register.dto.ts`
- `services/api/src/auth/dto/login.dto.ts`

**Files to change**

- `services/api/package.json` — add `class-validator`, `class-transformer`.
- `services/api/src/main.ts` — add `useGlobalPipes(new ValidationPipe(...))`.
- `services/api/src/auth/auth.controller.ts` — use `RegisterDto`, `LoginDto` in `@Body()`.
- `services/api/src/restaurants/dto/search-restaurants.dto.ts` — add class-validator decorators (e.g. `@IsOptional()`, `@IsString()`, etc.).

**Result:** Invalid register/login bodies and invalid search query params are rejected with 400 and validation messages.

---

## 0.5 — `GET /health`

**Goal:** Expose a health endpoint that returns 200 and `{ "status": "ok" }`. Optionally check DB connectivity for a “readiness” style check.

**Options**

- **Option A — Reuse root controller:** Add a `GET('health')` route in `AppController` that returns `{ status: 'ok' }`. Register `AppController` (and `AppService` if needed) in `AppModule` so the root and `/health` are mounted.
- **Option B — Dedicated health module:** Create `HealthController` (e.g. in `src/health/health.controller.ts`) with `@Get('health')` or `@Controller('health')` and `@Get()`, then register it in `AppModule`.

**Recommended (minimal):** Add `AppController` and `AppService` to `AppModule` (controllers and providers arrays). In `AppController`, add a method:

- `@Get('health') getHealth() { return { status: 'ok' }; }`

So `GET /health` returns 200 and `{ "status": "ok" }`.

**Optional:** Use `@nestjs/terminus` and a health check that pings Prisma/DB; return 503 if DB is down. For Phase 0, a simple 200 + `{ status: 'ok' }` is enough.

**Files to change**

- `services/api/src/app.module.ts` — add `controllers: [AppController]`, `providers: [AppService]`.
- `services/api/src/app.controller.ts` — add `@Get('health') getHealth()` returning `{ status: 'ok' }`. Keep or remove the root `@Get()` as you prefer (e.g. keep for “API is up” or remove and use only `/health`).

**Result:** Load balancers or scripts can call `GET /health` to confirm the API is up.

---

## Implementation order checklist

Do the tasks in this order:

1. **[0.1]** Fix `DELETE /restaurants/:id` (controller + service, 204/404).
2. **[0.2]** Create `services/api/.env.example` with `DATABASE_URL`, `PORT`, `JWT_SECRET`.
3. **[0.3]** Add env validation (Joi or custom) in `ConfigModule` / startup; remove `'supersecret'` in `AuthModule`.
4. **[0.4]** Install `class-validator` and `class-transformer`; enable `ValidationPipe` in `main.ts`; add auth DTOs and decorate search DTO.
5. **[0.5]** Add `GET /health` (e.g. in `AppController`) and register `AppController` in `AppModule`.

**Exit criteria (from roadmap):** DELETE works; env validated; health check and validation in place.
