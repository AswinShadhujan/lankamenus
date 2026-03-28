# API base URL (environment variables)

The web and mobile apps call the Lankamenus API. The API base URL is configured via environment variables so you can point to localhost in development and to your deployed API in production.

## Web (Next.js)

| Variable | When | Example |
|----------|------|--------|
| `NEXT_PUBLIC_API_URL` | Optional in dev; set in production | Dev: `http://localhost:3001` · Prod: `https://api.yourdomain.com` |

- **Where:** Set in `.env.local` (create from `apps/web/.env.local.example`).
- **Default:** If unset, the web app uses `http://localhost:3001`.
- **Build:** Next.js inlines `NEXT_PUBLIC_*` at build time, so set it before `next build` for production.

## Mobile (Expo)

| Variable | When | Example |
|----------|------|--------|
| `EXPO_PUBLIC_API_URL` | Optional in dev; set in production | Android emulator: `http://10.0.2.2:3001` · iOS simulator: `http://localhost:3001` · Prod: `https://api.yourdomain.com` |

- **Where:** Set in `.env` in `apps/mobile` (create from `apps/mobile/.env.example`).
- **Default:** If unset, the app uses `http://10.0.2.2:3001` (Android emulator). For iOS simulator, set `EXPO_PUBLIC_API_URL=http://localhost:3001`.
- **Production:** Set to your deployed API URL when building for production (EAS Build, etc.).

## Summary

| App | Env var | Dev default | Production |
|-----|---------|-------------|------------|
| Web | `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Set to deployed API URL |
| Mobile | `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:3001` (Android) | Set to deployed API URL |
