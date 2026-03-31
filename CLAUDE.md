# CLAUDE.md — The Slime Co Website

## Project Overview

**Entity:** Dossco Designs (DD)
**Project:** The Slime Co — slime powder kit e-commerce site
**Business:** Partnership between Jason Doss and Trav Eslinger. Slime powder kits sold via Shopify and Amazon. This site is the marketing/direct-sales channel.
**GitHub Org:** DosscoDesigns
**Linear:** Dossco Designs workspace (team DOS, use `mcp__linear-dd__*` tools)
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

- **Current:** API route at `/api/checkout` creates Stripe Checkout Sessions
- **Products:** Defined inline in the API route (slime-only, starter-kit, youth-group-kit)
- **Shipping:** US only, collected at checkout
- **Future:** Connect to Stripe org when created, move products to Stripe Dashboard, add webhooks for order fulfillment

## Design System

- **Theme:** Dark background (#0a0a0a), lime green (#a3e635) primary accent
- **Colors:** Lime (primary), Purple, Pink, Cyan (accents)
- **Fonts:** Geist Sans + Geist Mono (Google Fonts via next/font)
- **Animation philosophy:** Spring physics, scroll-linked motion, entrance animations on viewport intersection. Every interactive element should feel alive.
- **Images:** Currently using Unsplash stock photos. Replace with real product photography when available.

## Done Checklist

Before committing:
- [ ] `pnpm build` passes
- [ ] `pnpm lint` passes
- [ ] No recipe details in any file
- [ ] No secrets in staged files
- [ ] `.env.example` updated if env vars changed
- [ ] No debug/test files outside `TEMP/`
