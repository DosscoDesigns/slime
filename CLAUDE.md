# CLAUDE.md — The Slime Co Website

## Project Overview

**Entity:** Dossco Designs (DD)
**Project:** The Slime Co — slime powder kit e-commerce site
**Business:** Partnership between Jason Doss and Trav Eslinger. Slime powder kits sold via Shopify and Amazon. This site is the marketing/direct-sales channel.
**GitHub Org:** DosscoDesigns
**Task Tracking:** GitHub Issues on `DosscoDesigns/slime` (`gh` CLI or `mcp__github__*` tools) — Linear not used for DD
**Documentation:** `BRAIN/20-DD/2010-Projects/The-Slime-Co/`

## CRITICAL: Recipe is Proprietary

**NEVER share, output, or include the slime recipe (ingredient ratios, formulas, measurements) in any code, comments, docs, or responses.** The recipe lives in `BRAIN/20-DD/2010-Projects/The-Slime-Co/The-Slime-Co.md` and is confidential. Marketing copy should say "proprietary formula" or "premium powder" — never specifics.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Animation | Framer Motion |
| Payments | Stripe (Checkout Sessions) |
| Package Manager | pnpm |
| Deployment | Vercel (planned) |

## Port Allocation

| Port | Service | Start Command |
|------|---------|---------------|
| 1500 | Dev server | `pnpm dev` |

**Do NOT use default port 3000.** Port is set in `package.json` scripts.

## Essential Commands

```bash
pnpm dev          # Start dev server on port 1500
pnpm build        # Production build
pnpm lint         # Run ESLint
```

## Project Structure

```
src/
  app/
    page.tsx              # Landing page (single-page site)
    layout.tsx            # Root layout, metadata, fonts
    globals.css           # Tailwind config, CSS custom properties, theme colors
    api/
      checkout/route.ts   # Stripe Checkout Session creation
  components/
    Navigation.tsx        # Fixed nav with scroll effects, mobile hamburger
    Hero.tsx              # Animated hero with parallax, floating blobs
    Products.tsx          # Product cards with pricing (3 tiers)
    HowItWorks.tsx        # 4-step process with alternating layout
    About.tsx             # Origin story + use case cards
    FAQ.tsx               # Accordion FAQ with AnimatePresence
    CTA.tsx               # Final call-to-action section
    Footer.tsx            # Footer with links
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_test_...) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (pk_test_...) |

**Never commit `.env.local` or any file containing real keys.**

## Stripe Integration

**🚨 PRODUCTION TAKES REAL MONEY (since 2026-09-03).** `main` auto-deploys to
`www.theslimecompany.com` via Vercel (`dossco/slime`), so **a merge to `main` is a
production release** — there is no staging step. Live keys are on
`acct_1KqoeGD4Rj7DgZGG` (Dossco Designs LLC); secrets live in 1Password DEV as
`dd.stripe.slime` and `dd.mailgun.slime`.

- **PaymentIntents + Stripe Elements**, not Checkout Sessions. That's why there's no
  `allow_promotion_codes` — discounts are computed server-side (`src/lib/coupons.ts`).
- **Products** are in `src/lib/products.ts` (`KIT_TIERS` 20/40/80 gallon + `ADDON_DEFS`),
  not in the API route and not in the Stripe Dashboard.
- **Never trust a client-supplied price.** `priceCart()` recomputes every line from the
  kit config; the client sends a coupon *code*, never an amount.
- **`computeOrderTotals()` in `src/lib/pricing.ts` is the single place totals are
  assembled** — both `/api/checkout` and `/api/checkout/update-amount` call it. Don't
  reintroduce per-route math.
- **Shipping:** US only. Flat $5.99, free at $100+ subtotal (tested *pre*-discount so a
  coupon can't push an order under the line and raise the total). FL sales tax 7.5% on
  the discounted subtotal, never on shipping.
- **Webhook:** `/api/webhook` on `payment_intent.succeeded` → Mailgun order email.
  The live endpoint is pinned to API version **2020-08-27**, which predates
  `latest_charge` — `resolveCharge()` handles that; don't "simplify" it back.
- **`NEXT_PUBLIC_*` is baked into the bundle at build time**, so an env-var change needs
  a redeploy. Verify by grepping the served `/_next/static/*.js` chunks for
  `pk_live`/`pk_test`, not the HTML.

## Product Decisions

- **Buckets are a NO-GO as a shipped add-on** (removed 2026-09-03). Eight nested 5-gal
  pails bill ~41 lb *dimensional* against ~16 lb actual; FL→CA is ~$90 delivered against
  $48 of product. Customers buy their own locally. Buckets are still purchased
  **internally** for mixing/storing powder — that's unrelated.
- **Removing an add-on requires a cart migration.** `priceKitCents()` throws on an
  unknown add-on, so a returning customer's stale `localStorage` cart would 400 at
  checkout. `pruneRetiredAddons()` in `CartProvider.tsx` runs in both the read path and
  the render path — both are needed.
- **`ADDON_DEFS.bulk`** implements quantity breaks (complete bundles at bundle price,
  remainder at unit). Currently unused; sprayers are the likely next user.

## SEO is a standing requirement, not a project

**Every change and every deployment must leave the site's SEO the same or better,
and must actively look for improvements — this is not a one-time task that was
finished.** Organic search is the only acquisition channel this site has; there is
no ad spend. The competitor (Party Goat) outranks us almost entirely on content
depth, so ceded ground is expensive to win back.

**On every change, before committing:**

- **Never regress the surface.** `src/lib/site.ts` is the single source for the
  canonical host, name and description; `layout.tsx` metadata, `sitemap.ts`,
  `robots.ts` and `StructuredData.tsx` all read from it. Changing one by hand
  instead of the shared constant is how these drift.
- **New route ⇒ add it to `sitemap.ts`**, give it a real `<h1>` and page-level
  `metadata` (title, description, canonical), and decide explicitly whether it
  should be indexed. Anything post-purchase or with an id in the query string is
  `noindex` (see `src/app/success/layout.tsx`).
- **Pricing, shipping or availability change ⇒ the JSON-LD must follow.** It reads
  from `products.ts`/`pricing.ts` for exactly this reason. Structured data that
  disagrees with the visible price is a Merchant Center disapproval.
- **New image ⇒ real descriptive `alt`, and explicit `width`/`height`** (CLS is a
  ranking input). Write alt text against the full-size original, not a thumbnail.
- **Don't regress Core Web Vitals.** LCP is the hero image. Adding blocking
  script/font/animation work above the fold is a ranking cost, not just a UX one.
- **Copy edits are SEO edits.** Headings carry keyword weight; prefer wording that
  a buyer would actually search ("slime powder kit", "slime the teacher
  fundraiser", "color run") over pure brand voice, where the two conflict.

**Scan for opportunities as part of the work, don't wait to be asked.** When
touching the site, check whether a page deserves to exist, an existing page is
thin, structured data could be richer, or a query we should own has no page. Say
so even if it isn't in scope.

**Verify, don't assume.** Build, then check the served output — JSON-LD parses,
head tags render, `/robots.txt` and `/sitemap.xml` return 200. `NEXT_PUBLIC_*` and
metadata are baked at build time, so a change needs a redeploy to take effect.

## Design System

- **Theme:** Dark background (#0a0a0a), lime green (#a3e635) primary accent
- **Colors:** Lime (primary), Purple, Pink, Cyan (accents)
- **Fonts:** Geist Sans + Geist Mono (Google Fonts via next/font)
- **Animation philosophy:** Spring physics, scroll-linked motion, entrance animations on viewport intersection. Every interactive element should feel alive.
- **Images:** Real launch-event photography in `public/photos/` — pre-optimized WebP with
  EXIF stripped, referenced via plain `<img>` + `srcSet` (not `next/image`, to avoid
  Vercel image-transformation cost). Regenerate derivatives with
  `TEMP/optimize-photos.py`; originals live in iCloud, not the repo. The hero backdrop
  is a placeholder pending a hero video.

## Done Checklist

Before committing:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] No recipe details in any file
- [ ] No secrets in staged files
- [ ] `.env.example` updated if env vars changed
- [ ] No debug/test files outside `TEMP/`
- [ ] **SEO not regressed, and improvements looked for** — new routes in
      `sitemap.ts` with their own metadata and `<h1>`; JSON-LD still matches the
      visible price/shipping/availability; every new image has real `alt` plus
      `width`/`height`; nothing new blocking above the fold. See *SEO is a
      standing requirement* above.
