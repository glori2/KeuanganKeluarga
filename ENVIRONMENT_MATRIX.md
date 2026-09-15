# 🌐 ENVIRONMENT VARIABLE MATRIX

**Application:** KeuanganKeluarga  
**Target Environments:** Local (.env.local), Vercel Production, Supabase PostgreSQL  
**Audit Date:** September 2026

---

## 1. Environment Variables Configuration Matrix

| Variable | Local (.env.local) | Vercel Production | Supabase Dashboard | Client Safe (Browser) | Required | Purpose |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | SET | REQUIRED | N/A | **YES** | **YES** | Supabase project API gateway URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | SET | REQUIRED | N/A | **YES** | **YES** | Supabase anonymous public API key |
| `SUPABASE_SERVICE_ROLE_KEY` | SET | REQUIRED (Server-only) | N/A | **NO** | **YES** | Supabase privileged admin client for onboarding |
| `DATABASE_URL` | SET | REQUIRED (Server-only) | Active DB | **NO** | **YES** | Direct connection pooler string (`postgres://...`) |
| `TELEGRAM_BOT_TOKEN` | SET | REQUIRED (Server-only) | N/A | **NO** | **YES** | Bot token for Telegram Bot API communication |
| `TELEGRAM_WEBHOOK_SECRET` | SET | REQUIRED (Server-only) | N/A | **NO** | **YES** | Secret token for verifying `X-Telegram-Bot-Api-Secret-Token` |

---

## 2. Security Scope Guidelines

1. **Client-Side Environment Variables (`NEXT_PUBLIC_*`):**
   - Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are prefixed with `NEXT_PUBLIC_`.
   - These keys are safe for browser execution as row-level data access is strictly governed by PostgreSQL Row-Level Security (RLS).

2. **Server-Side Secret Variables:**
   - `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_WEBHOOK_SECRET` MUST NOT be prefixed with `NEXT_PUBLIC_`.
   - In Vercel Project Settings ➔ Environment Variables, configure them with **Production**, **Preview**, and **Development** targets enabled.

3. **No Hardcoded Secrets in Git:**
   - All `.env*` files are excluded in `.gitignore`.
   - Production secrets are injected at runtime by the Vercel hosting platform.
