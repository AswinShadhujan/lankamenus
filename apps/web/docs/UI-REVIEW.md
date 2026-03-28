# UI Implementation — Code Review

## 1. Security

### ✅ In place
- **No raw HTML**: No `dangerouslySetInnerHTML`, `innerHTML`, or `eval`; React’s default escaping is used for all user/API content.
- **URL encoding**: Search term is encoded with `encodeURIComponent(q)` when pushing to the URL in `MainLayout.handleSearchSubmit`.
- **IDs in URLs**: Links and image URLs use `restaurant.id` (number from API) or route `id`; photo URL uses `restaurant.id` from the API response, not unsanitized input.
- **Auth token**: Token lives in `localStorage` (existing pattern); API interceptor adds `Authorization: Bearer` and clears token on 401. No token in query or visible in UI.

### ⚠️ Existing / accepted risks
- **Token in localStorage**: Vulnerable to XSS; if the app is later exposed to stored XSS, consider httpOnly cookies for the token. No change made in this UI pass.
- **401 on public routes**: Global interceptor only redirects to `/admin/login` when `pathname.startsWith('/admin')`. On `/favourites` or `/account`, 401 clears the token but does not redirect; those pages handle 401 in their own `.catch` (e.g. favourites and account both redirect to `/login`). Behaviour is correct.

### ℹ️ Optional hardening
- **Search input**: No client-side max length; very long queries are sent to the API. Backend should enforce limits; adding e.g. `maxLength={200}` would reduce unnecessary requests.

---

## 2. Validation

### ✅ In place
- **Login/register**: `type="email"` and `required` on email; `required` on password. No new validation removed.
- **Theme in storage**: `ThemeProvider` only sets theme from storage when value is `'light'` or `'dark'`, avoiding arbitrary values.

### ⚠️ Gaps (non-blocking)
- **Search**: No client-side length or format validation; backend should validate.
- **Route params**: `id` from `useParams()` is used as string in API calls (e.g. `/restaurants/${id}`). Backend returns 404 for non-numeric or missing IDs; UI shows “Restaurant not found”. No injection risk.

---

## 3. Error handling

### ✅ In place
- **Home**: Fetch failure sets `fetchError` and shows `ErrorState` with Retry; loading and empty states; location errors shown.
- **Restaurant detail**: 404 vs generic error; loading skeleton; hero image `onError` fallback.
- **Dish page**: 404 vs generic error; loading skeleton; image `onError`.
- **Favourites**: 401 → redirect to `/login`; other errors → empty list; loading state; remove button disabled while request in flight.
- **Account**: No token → redirect to `/login`; `/auth/me` failure (401/403) → clear token and redirect to `/login`.
- **Login/register**: API error message shown (single string or first element of array).
- **API interceptor**: 401 clears token and redirects admin routes to `/admin/login`.

### ⚠️ Improvements
- **Districts load failure (home)**: Only `console.error`; user gets no message. Consider a small inline message or leaving the district filter empty with optional “Could not load districts” text.
- **Favourite toggle (home & restaurant detail)**: `.catch(() => {})` swallows errors; user gets no feedback on failure. Consider a short toast or inline message and/or reverting optimistic state.
- **Remove favourite (favourites page)**: Same; `.catch(() => {})` and no user feedback. Consider error message and/or reverting removal.

---

## 4. Missing tests

### Current state
- **No tests**: No `*.test.ts(x)` or `*.spec.ts(x)` in `apps/web`. The UI work did not add a test setup or tests.

### Recommended (when adding tests)
- **Unit**
  - `ThemeProvider`: theme from storage, `prefers-color-scheme`, toggle, `data-theme` and storage updates.
  - `SearchBar`: controlled value, Enter calls `onSubmit` with current value.
  - `CategoryChip`, `RatingBadge`, `FavoriteButton`, `EmptyState`, `ErrorState`: render and callbacks.
- **Integration / E2E**
  - Home: search updates URL and list; district filter; “Use my location” and error message; loading and empty states.
  - Auth: login/logout, favourites and account redirect when unauthenticated.
  - Restaurant detail: tabs, favourite toggle, menu section content.
  - Favourites: list, remove, empty state.

---

## 5. Fix applied

- **Navbar search submit**: `handleSearchSubmit` now accepts the value from `SearchBar` (e.g. on Enter) and uses it when calling `onSearchSubmit`, so the submitted query always matches the input even if state is slightly out of sync.

---

## 6. Summary

| Area           | Status | Notes                                                                 |
|----------------|--------|-----------------------------------------------------------------------|
| Security       | OK     | No XSS vectors found; URLs and IDs safe; token handling unchanged.   |
| Validation     | OK     | Form and theme validation adequate; optional search max length.       |
| Error handling | OK     | Major flows covered; favourite/remove errors could be surfaced.     |
| Tests          | Missing| No tests in web app; add when introducing a test stack.             |

No backend or API contracts were changed; only UI structure, layout, and styling were reviewed.
