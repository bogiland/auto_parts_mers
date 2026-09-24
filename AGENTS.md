# AGENTS.md - Rules for NAA.md Layout

The layout reference is armtek.ru. The accent is NAA red.

## Tokens

- Colors, font sizes, radii, shadows, and breakpoints come only from `web/src/app/globals.css` (`@theme`) or `tailwind.config.ts`.
- Allowed arbitrary values only: `basis-[calc(...)]` for carousels, `aspect-[...]`, `min-h-[calc(var(--lh-body)*2)]`, `pb-[env(safe-area-inset-bottom)]`, the logo height `h-[22px]`, and `grid-cols-[1fr_1fr_1fr_auto]` for the expert form.
- Do not use arbitrary `text-[15px]`, `p-[13px]`, `w-[184px]`, JSX hex colors, `clamp()`, or `vw`/`em` for fonts.
- Allowed spacing values are 4, 8, 12, 16, 24, 32, 40, and 48px.
- Use Roboto with weights 400, 500, and 700 only. Do not use 800 or 900.
- Use only `text-section`, `text-block`, `text-price`, `text-body`, `text-meta`, `text-tab`, `text-hero`, `text-btn`, `text-badge`, `text-nav`, `text-lead`, `text-phone`, and `text-phone-lg` for typography. Do not add breakpoint-specific sizes to these classes.
- Discount price and discount badge use `text-deal` and `bg-deal`. The price size is `text-price`.
- Use `rounded-ui` (8px) everywhere, except `rounded-badge` for discount badges.

## Layout

- Use a single site container: `container-site` (max 1400px, 16px side padding that becomes 32px at 1200px).
- Each home-page section is a direct child of `<main class="container-site section-stack">`. Sections must not apply their own vertical spacing.
- A section header uses `<div class="flex items-baseline justify-between mb-4">`, a `<h2 class="text-section font-bold">`, and a "View all" link with `text-body text-ink-2 hover:text-accent`.

## Responsive Rules

- Use `sm 576`, `md 768`, `lg 992`, `xl 1200`, and `2xl 1400`. Desktop layouts start only at `xl`.
- Use mobile-first rules: base phone styles, then `md:`, `lg:`, and `xl:`.
- Every grid uses only Tailwind `grid-cols-N`. Do not use pixel or auto grid tracks, `max-content`, or a bare `1fr` for a layout parent.
- Flex or grid children that can overflow need `min-w-0`.
- Horizontal lists must live in `scroller-x`. Do not use `min-width: max-content` outside `scroller-x`.
- Size elements by grid fractions or approved carousel basis calculations, never by pixel widths.
- Use `next/image` with `sizes`, an `aspect-[...]` wrapper, and `object-contain` for products or `object-cover` for banners. Banner text must be HTML overlay content or use a separate mobile image.

## Verification

1. Keep `npm run dev` running and execute `npm run qa` for 360, 390, 768, 1024, 1280, and 1440px.
2. Inspect all screenshots in `web/qa/shots/` against the task reference.
3. Report changed files, removed classes, and any remaining work.

## Limits

- Do not change business logic, API, cart, or routes unless the task explicitly asks.
- Do not add VIN or licence-plate search.
- When a component is rewritten in Tailwind, remove its previous BEM styles.
- Do not introduce colors that only resemble an existing token.
