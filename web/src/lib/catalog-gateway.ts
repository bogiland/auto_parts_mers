import { homepageSeed } from "@/data/homepage.seed";
import type { HomepageData, Product } from "@/domain/catalog";

/**
 * Рекомендованные карточки — это выбор из тех же деталей, а не их копии.
 *
 * Раньше в наборе лежали отдельные записи «recommended-…» с тем же артикулом,
 * названием и ценой. В базе на одну деталь приходилось по две строки с разными
 * остатками, поэтому проданная деталь оставалась «в наличии» в «Товаре недели»,
 * а её карточка открывалась по двум адресам. Теперь список собирается из
 * `popularProducts` — один идентификатор, один остаток, один адрес.
 */
function recommendedFrom(products: Product[]): Product[] {
  // Берём со второй половины набора: на главной два блока рядом, и одинаковый
  // порядок в обоих выглядел бы как ошибка.
  const half = Math.floor(products.length / 2);
  return [...products.slice(half), ...products.slice(0, half)];
}

export async function getHomepage(): Promise<HomepageData> {
  const popular = homepageSeed.popularProducts.map((product) => ({ ...product, rating: 0, reviewCount: 0 }));
  const recommended = homepageSeed.recommendedProducts.length
    ? homepageSeed.recommendedProducts.map((product) => ({ ...product, rating: 0, reviewCount: 0 }))
    : recommendedFrom(popular);
  return {
    ...homepageSeed,
    heroSlides: homepageSeed.heroSlides
      .filter((slide) => slide.isEnabled)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    categories: homepageSeed.categories.filter((category) => category.isVisible),
    popularProducts: popular,
    recommendedProducts: recommended,
  };
}
