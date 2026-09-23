# NAA.md Homepage Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive, reference-faithful Russian NAA.md home page foundation with reusable catalog components and typed mock data ready for a C# API.

**Architecture:** Create a standalone `web/` Next.js App Router application. Keep visual components independent from data access: the page reads typed data through a local catalog gateway that can later be replaced by ASP.NET Core HTTP calls without changing component interfaces. The initial page uses two real banner records while the model permits five editable banners.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Lucide React, Vitest, Testing Library.

## Global Constraints

- The public brand is exactly `NAA.md`.
- Russian is the root locale; Romanian will use `/ro/` in the next localization task.
- Match the approved reference’s compact catalog layout; do not add decorative cards or visual filler.
- Hero slides transition every 3 seconds, pause on hover/focus, and support keyboard/manual navigation.
- `HeroSlide`, `Category`, `Product`, `Brand`, `VehicleModel`, `OrderDraft`, and `VinRequest` must be typed domain models, not page-local objects.
- Keep product images out of database models; use URL-based media fields only.
- Never store auth tokens in browser local storage.
- The current directory is not a Git repository. Do not attempt a commit until the user initializes one.

---

## Planned File Structure

| Path | Responsibility |
|---|---|
| `web/` | Standalone Next.js application root. |
| `web/src/domain/catalog.ts` | Reusable domain types for catalog, banners and customer intents. |
| `web/src/data/homepage.seed.ts` | Initial Mercedes-oriented content, category images and contacts. |
| `web/src/lib/catalog-gateway.ts` | Typed data boundary for mock data today and C# API tomorrow. |
| `web/src/components/layout/*` | Header, secondary navigation and page-width layout. |
| `web/src/components/catalog/*` | Sidebar, carousel, benefit strip and reusable category card. |
| `web/src/components/forms/*` | VIN request and help form presentation. |
| `web/src/app/page.tsx` | Russian default home route. |
| `web/src/app/layout.tsx` | Root metadata, font and global shell. |
| `web/src/app/globals.css` | Design tokens and focused global styles only. |
| `web/src/test/*` | Component and interaction tests. |
| `web/docs/api-contract.md` | C# API contracts and security boundary notes. |

---

### Task 1: Create the web application and test harness

**Files:**
- Create: `web/package.json`
- Create: `web/src/app/layout.tsx`
- Create: `web/src/app/page.tsx`
- Create: `web/src/app/globals.css`
- Create: `web/vitest.config.ts`
- Create: `web/src/test/setup.ts`
- Test: `web/src/test/smoke.test.tsx`

**Produces:** A runnable Next.js app with Tailwind and a passing component test command.

- [ ] **Step 1: Scaffold the application without a nested Git repository.**

Run:

```powershell
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir --use-npm --import-alias "@/*" --disable-git
```

- [ ] **Step 2: Add Vitest and Testing Library.**

Run:

```powershell
npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install lucide-react
```

- [ ] **Step 3: Add the failing smoke test.**

```tsx
import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

it("renders the NAA.md brand", () => {
  render(<HomePage />);
  expect(screen.getByText("NAA.md")).toBeInTheDocument();
});
```

- [ ] **Step 4: Configure Vitest.**

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"] },
});
```

`src/test/setup.ts` contains:

```ts
import "@testing-library/jest-dom/vitest";
```

Add this script to `package.json`:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

- [ ] **Step 5: Make the smoke test pass.**

Replace the generated `src/app/page.tsx` with:

```tsx
export default function HomePage() {
  return <main>NAA.md</main>;
}
```

- [ ] **Step 6: Run the test and build.**

Run:

```powershell
npm run test -- --run
npm run build
```

Expected: both commands exit with code `0`.

### Task 2: Define the catalog boundary and seed data

**Files:**
- Create: `web/src/domain/catalog.ts`
- Create: `web/src/data/homepage.seed.ts`
- Create: `web/src/lib/catalog-gateway.ts`
- Test: `web/src/lib/catalog-gateway.test.ts`

**Consumes:** The app created in Task 1.

**Produces:** `getHomepage(): Promise<HomepageData>` for all public page content.

- [ ] **Step 1: Write a failing data-boundary test.**

```ts
import { getHomepage } from "@/lib/catalog-gateway";

it("returns only enabled hero slides and initial categories", async () => {
  const homepage = await getHomepage();
  expect(homepage.heroSlides).toHaveLength(2);
  expect(homepage.heroSlides.every((slide) => slide.isEnabled)).toBe(true);
  expect(homepage.categories.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Define stable domain interfaces.**

```ts
export type Locale = "ru" | "ro";

export interface MediaAsset { alt: string; url: string; }
export interface Category { id: string; slug: string; name: string; productCount: number; image: MediaAsset; isVisible: boolean; }
export interface HeroSlide { id: string; title: string; subtitle: string; ctaLabel: string; ctaHref: string; image: MediaAsset; isEnabled: boolean; sortOrder: number; }
export interface HomepageData { phone: string; hours: string; heroSlides: HeroSlide[]; categories: Category[]; }
export interface Product { id: string; sku: string; name: string; priceMdl: number | null; priceMode: "fixed" | "on_request"; image: MediaAsset; }
export interface Brand { id: string; name: string; slug: string; }
export interface VehicleModel { id: string; brandId: string; name: string; slug: string; }
export interface OrderDraft { items: Array<{ productId: string; quantity: number }>; contactPhone: string; }
export interface VinRequest { vin: string; contactPhone: string; message?: string; }
```

- [ ] **Step 3: Add two enabled Mercedes seed slides and visible reference categories.**

Implement `homepageSeed` with `phone: "+373 68 123 456"`, `hours: "Пн–Сб 09:00–18:00"`, two sequential enabled slides whose CTA is `"Каталог Mercedes"` and `"/catalog/mercedes"`, plus categories for engine, brakes, suspension, transmission, electrical equipment, cooling, body, interior, exhaust and filters. Use local image files under `public/images/` with descriptive Russian alt text.

- [ ] **Step 4: Implement the gateway.**

```ts
import { homepageSeed } from "@/data/homepage.seed";
import type { HomepageData } from "@/domain/catalog";

export async function getHomepage(): Promise<HomepageData> {
  return {
    ...homepageSeed,
    heroSlides: homepageSeed.heroSlides
      .filter((slide) => slide.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    categories: homepageSeed.categories.filter((category) => category.isVisible),
  };
}
```

- [ ] **Step 5: Verify the boundary.**

Run:

```powershell
npm run test -- --run src/lib/catalog-gateway.test.ts
```

Expected: the test passes with exactly two enabled hero slides.

### Task 3: Build shell, header and category navigation

**Files:**
- Create: `web/src/components/layout/site-header.tsx`
- Create: `web/src/components/layout/secondary-nav.tsx`
- Create: `web/src/components/catalog/category-sidebar.tsx`
- Create: `web/src/components/ui/icon-action.tsx`
- Modify: `web/src/app/globals.css`
- Test: `web/src/components/layout/site-header.test.tsx`
- Test: `web/src/components/catalog/category-sidebar.test.tsx`

**Consumes:** `HomepageData` and `Category` from Task 2.

**Produces:** A desktop and mobile-safe header and category sidebar reusable by catalog pages.

- [ ] **Step 1: Write interaction tests.**

```tsx
it("exposes the Russian and Romanian locale choices", () => {
  render(<SiteHeader phone="+373 68 123 456" hours="Пн–Сб 09:00–18:00" />);
  expect(screen.getByRole("link", { name: "RU" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "RO" })).toHaveAttribute("href", "/ro/");
});
```

- [ ] **Step 2: Implement `IconAction` with an accessible label.**

```tsx
export function IconAction({ label, href, icon }: { label: string; href: string; icon: React.ReactNode }) {
  return <a aria-label={label} className="icon-action" href={href}>{icon}<span>{label}</span></a>;
}
```

- [ ] **Step 3: Implement the header and secondary navigation.**

Use Lucide icons for user, heart, shopping cart, phone and search. Render the exact approved labels, Russian search placeholder `Поиск по коду детали, модели или категории...`, locale links, temporary contact data, and the five secondary navigation links. Keep the search control an HTML form with `role="search"`.

- [ ] **Step 4: Implement a data-driven category sidebar.**

The component signature is:

```tsx
export function CategorySidebar({ categories }: { categories: Category[] }): React.JSX.Element
```

Render a heading `Все категории`, one link per category, its image-independent Lucide icon, and an accessible arrow. Do not hard-code category names inside the component.

- [ ] **Step 5: Add only shared visual tokens.**

Define CSS variables for white/near-white surfaces, ink, muted text, thin borders, dark CTA and restrained red accent. Use a maximum content width of `1600px`, a 24px desktop gutter and zero letter-spacing. Maintain 8px controls and 12px content card radii.

- [ ] **Step 6: Run component tests.**

Run:

```powershell
npm run test -- --run src/components/layout/site-header.test.tsx src/components/catalog/category-sidebar.test.tsx
```

Expected: both tests pass.

### Task 4: Implement the carousel and reusable category cards

**Files:**
- Create: `web/src/components/catalog/hero-carousel.tsx`
- Create: `web/src/components/catalog/category-card.tsx`
- Create: `web/src/components/catalog/benefit-strip.tsx`
- Test: `web/src/components/catalog/hero-carousel.test.tsx`
- Test: `web/src/components/catalog/category-card.test.tsx`

**Consumes:** `HeroSlide` and `Category` from Task 2.

**Produces:** Accessible reference-faithful hero and category grid components.

- [ ] **Step 1: Write carousel tests before implementation.**

```tsx
it("moves to the next slide through its labelled control", async () => {
  const user = userEvent.setup();
  render(<HeroCarousel slides={slides} />);
  await user.click(screen.getByRole("button", { name: "Следующий слайд" }));
  expect(screen.getByRole("heading", { name: slides[1].title })).toBeVisible();
});
```

- [ ] **Step 2: Implement `HeroCarousel`.**

Use client-side state only for the current index, a 3000ms interval, a `paused` boolean updated by `onMouseEnter`, `onMouseLeave`, `onFocusCapture`, and `onBlurCapture`, plus `aria-live="polite"`. Use `next/image` with a `priority` image for the first slide. The visual layout is text on the left and a Mercedes vehicle-plus-parts image on the right. Do not show a fake Mercedes trademark logo unless supplied as an approved asset.

- [ ] **Step 3: Implement `CategoryCard`.**

```tsx
export function CategoryCard({ category }: { category: Category }): React.JSX.Element {
  return <a href={`/catalog/${category.slug}`} className="category-card" aria-label={category.name} />;
}
```

The image uses `object-contain`; the name is clamped to two lines and the count is a muted line. The card has a stable height so labels cannot shift the grid.

- [ ] **Step 4: Implement the benefit strip.**

Render exactly three benefit items: original/compatible parts, delivery across Moldova, and VIN compatibility check. Each uses a Lucide icon and concise two-line copy.

- [ ] **Step 5: Verify the user-visible behavior.**

Run:

```powershell
npm run test -- --run src/components/catalog/hero-carousel.test.tsx src/components/catalog/category-card.test.tsx
```

Expected: manual carousel navigation and category rendering tests pass.

### Task 5: Compose the home route, VIN/help panels and public metadata

**Files:**
- Create: `web/src/components/forms/vin-request-form.tsx`
- Create: `web/src/components/forms/help-panel.tsx`
- Modify: `web/src/app/page.tsx`
- Modify: `web/src/app/layout.tsx`
- Create: `web/docs/api-contract.md`
- Test: `web/src/components/forms/vin-request-form.test.tsx`
- Test: `web/src/app/page.test.tsx`

**Consumes:** All components and `getHomepage()` from Tasks 2–4.

**Produces:** A complete visual first screen, an honest VIN request form and initial SEO metadata.

- [ ] **Step 1: Write a VIN validation test.**

```tsx
it("rejects an invalid VIN before submission", async () => {
  const user = userEvent.setup();
  render(<VinRequestForm />);
  await user.type(screen.getByLabelText("VIN или номер кузова"), "123");
  await user.click(screen.getByRole("button", { name: "Найти" }));
  expect(screen.getByText("Введите VIN из 17 символов.")).toBeVisible();
});
```

- [ ] **Step 2: Implement the VIN form.**

Validate `^[A-HJ-NPR-Z0-9]{17}$` after uppercasing. For this frontend milestone, submit to a local non-persistent adapter and display `Заявка принята. Мы свяжемся с вами.`; the form’s request body matches `VinRequest`. Do not claim that an automatic VIN lookup occurred.

- [ ] **Step 3: Compose `page.tsx`.**

`HomePage` is an async server component:

```tsx
export default async function HomePage() {
  const homepage = await getHomepage();
  return <main data-category-count={homepage.categories.length} />;
}
```

Use semantic `header`, `nav`, `aside`, `section`, and a single `h1` in the first slide. The page must not include a mock chat widget that pretends a human is online.

- [ ] **Step 4: Set baseline metadata.**

Set a Russian title and description naming NAA.md, Mercedes parts and Slobodzeya; set `metadataBase` only when the production domain is known. Add Romanian alternate route support in the next localization plan rather than publishing a broken alternate link.

- [ ] **Step 5: Document the C# boundary.**

`web/docs/api-contract.md` defines these future endpoints: `GET /api/v1/homepage`, `POST /api/v1/vin-requests`, `POST /api/v1/orders`, `POST /api/v1/admin/auth/login`, and `POST /api/v1/admin/auth/logout`. It states cookie sessions, two active device sessions, rate limiting and CSRF requirements.

- [ ] **Step 6: Run the full test suite and production build.**

Run:

```powershell
npm run test -- --run
npm run build
```

Expected: tests and production build finish with exit code `0`.

### Task 6: Visual and responsive verification

**Files:**
- Modify: files from Tasks 3–5 only if verification finds an issue.
- Create: `web/docs/homepage-verification.md`

**Consumes:** The running application from Task 5.

**Produces:** Evidence that the home page is usable and close to the approved desktop reference without breaking mobile.

- [ ] **Step 1: Start the development server.**

Run:

```powershell
npm run dev
```

- [ ] **Step 2: Inspect desktop and mobile layouts.**

At desktop width, verify the header, sidebar, banner, benefit strip, category grid and VIN/help row appear in that order without overlap. At 390px width, verify category navigation is reachable, all text fits controls, and no horizontal scrollbar appears.

- [ ] **Step 3: Check keyboard use.**

Tab through the header, locale links, carousel controls, category links and VIN form. Verify focus is visible and the carousel pauses during focus.

- [ ] **Step 4: Record the result.**

`homepage-verification.md` records the tested viewport widths, commands run, passing tests, and any intentional temporary content: the phone number and two initial slides.

## Plan Self-Review

- Spec coverage: Tasks 1–6 cover the approved first screen, reusable components, two initial Mercedes slides, 3-second carousel, category data, VIN request UI, baseline RU SEO, PostgreSQL/media-ready boundary and security contract. Full C# API, admin UI, RO implementation, checkout persistence, analytics, services pages and load/security testing each require their own implementation plan.
- Placeholder scan: no implementation step relies on unspecified names, interfaces, behaviors or test commands.
- Type consistency: `HomepageData`, `HeroSlide`, `Category` and `VinRequest` are defined in Task 2 and consumed under the same names in later tasks.
