import { describe, expect, it } from "vitest";
import { createCatalogListing } from "@/lib/catalog-listing";
import type { HomepageData, Product } from "@/domain/catalog";

const product = (id: string, donorId: string, stock: number): Product => ({ id, donorId, sku: id, name: id, brand: "NAA", priceMdl: 10, priceMode: "fixed", rating: 0, reviewCount: 0, image: { alt: "", url: "/image.png" }, stock });
const homepage: HomepageData = { phone: "", hours: "", heroSlides: [], categories: [], popularProducts: [], recommendedProducts: [], posts: [], liveProducts: [product("a", "donor-a", 1), product("b", "donor-b", 1), product("c", "donor-a", 0)] };

describe("home vehicle selection", () => {
  it("shows only available parts from the selected donors", () => {
    const result = createCatalogListing(homepage, { donors: "donor-a", availability: "in_stock" });
    expect(result.products.map(item => item.id)).toEqual(["a"]);
  });
  it("supports multiple donors for one vehicle", () => {
    const result = createCatalogListing(homepage, { donors: "donor-a,donor-b", availability: "in_stock" });
    expect(result.products.map(item => item.id)).toEqual(["a", "b"]);
  });
});
