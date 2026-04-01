# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LÉGALO is a legal platform for Venezuela that uses AI to diagnose legal problems and connect users with verified lawyers. It is a **monorepo** with two frontends sharing a Supabase backend.

## Commands

### Root (monorepo)
```bash
npm run install:all   # Install all workspace dependencies
npm run admin         # Start admin Next.js dev server
npm run mobile        # Start Expo mobile dev server
```

### Admin (`cd admin`)
```bash
npm run dev           # Development server
npm run build         # Production build
npm run lint          # ESLint
npm run create-superadmin  # Seed initial admin user via node script
```

### Mobile (`cd mobile`)
```bash
npm start             # Expo dev server (interactive)
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run seed:demo     # Seed demo data via node script
```

### Database
```bash
# Apply migrations manually via Supabase CLI or run supabase/run-migrations.js
node supabase/run-migrations.js
```

## Architecture

### Monorepo Structure
```
legalo-app/
├── admin/        # Next.js 16.2 admin dashboard (App Router)
├── mobile/       # React Native 0.81 / Expo 54 mobile app
└── supabase/     # SQL migrations + Edge Functions
```

### Backend: Supabase
There is **no custom API server**. Both apps communicate directly with Supabase:
- **Auth**: Supabase Auth (email/password), session via cookies (admin) or AsyncStorage (mobile)
- **Database**: PostgreSQL with RLS policies enforcing row-level access per role
- **Storage**: Supabase Storage buckets (avatars, lawyer documents)
- **Edge Functions**: `supabase/functions/legal-chat/` (Gemini AI) and `supabase/functions/send-expo-push/` (push notifications)

### Admin App (`admin/`)
- **Framework**: Next.js 16.2 with App Router — **read `node_modules/next/dist/docs/` before writing code**, this version has breaking changes vs older Next.js
- **Backend calls**: Only via Next.js Server Actions in `admin/src/actions/` — no `app/api/` routes
- **Supabase clients**:
  - `admin/src/lib/supabase/server.ts` — cookie-based SSR client (anon key, respects RLS)
  - `admin/src/lib/supabase/admin.ts` — service role client (bypasses RLS, for admin operations)
- **Auth guard**: `admin/middleware.ts` protects all `/dashboard/*` routes; redirects non-admin users to `/login`
- **Routes**: `/login`, `/dashboard` (overview), `/dashboard/casos/[id]`, `/dashboard/abogados/[id]`, `/dashboard/clientes/[id]`, `/dashboard/pagos`

### Mobile App (`mobile/`)
- **Auth state**: Managed in `mobile/src/contexts/AuthContext.tsx`
- **Navigation**: React Navigation native-stack; roles (`lawyer`, `client`) determine which screen tree is shown after login
- **Lawyer flow**: Multi-step onboarding (`mobile/src/screens/lawyer-onboarding/`), then lawyer dashboard with tabs (casos, leads, payments, profile)
- **Client flow**: Case creation, lawyer search/payment, chat
- **AI Chat**: Calls Supabase Edge Function `legal-chat` with `EXPO_PUBLIC_GEMINI_API_KEY`

### User Roles & Data Model
Three roles in `profiles.role`: `admin`, `lawyer`, `client`. Key tables:
- `profiles` — extends `auth.users`; holds role, lawyer onboarding state, subscription plan (`trial`/`premium`/`basic`), geolocation
- `cases` — links client + lawyer; status machine from `awaiting_payment` → `active` → `closed`; includes rating
- `transactions` — payment escrow records; `purpose` = `case_contact` or `lawyer_subscription`
- `lawyer_notifications` / `client_notifications` — in-app notifications per role
- `connection_credits` — refund coupons issued when a lawyer rejects a case
- `leads` — contact inquiries from clients to lawyers before formal case creation
- `push_tokens` — Expo push tokens for lawyer/client notifications

### Environment Variables
**Admin** (`admin/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

**Mobile** (`mobile/.env`):
```
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_GEMINI_API_KEY
EXPO_PUBLIC_FEE_USD   # default connection fee in USD (e.g. 25)
```
