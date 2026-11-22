import { homepageSeed } from "@/data/homepage.seed";
import type { HomepageData } from "@/domain/catalog";

export async function getHomepage(): Promise<HomepageData> {
  return {
    ...homepageSeed,
    heroSlides: homepageSeed.heroSlides
      .filter((slide) => slide.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    categories: homepageSeed.categories.filter((category) => category.isVisible),
    popularProducts: homepageSeed.popularProducts.map(product=>({...product,rating:0,reviewCount:0})),
    recommendedProducts: homepageSeed.recommendedProducts.map(product=>({...product,rating:0,reviewCount:0})),
  };
}
