import { describe, expect, it } from "vitest";

import { getHomepage } from "@/lib/catalog-gateway";

describe("getHomepage", () => {
  it("returns two enabled Mercedes slides in display order", async () => {
    const homepage = await getHomepage();

    expect(homepage.heroSlides).toHaveLength(2);
    expect(homepage.heroSlides.every((slide) => slide.isEnabled)).toBe(true);
    expect(homepage.heroSlides[0]?.ctaHref).toBe("/catalog/mercedes");
  });

  it("returns visible category data", async () => {
    const homepage = await getHomepage();

    expect(homepage.categories.length).toBeGreaterThan(0);
    expect(homepage.categories.every((category) => category.isVisible)).toBe(true);
  });
});
