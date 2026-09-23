export function RecommendedProductPlaceholder() {
  return (
    <article aria-label="Место для рекомендованного товара" className="recommended-product-placeholder">
      <div className="recommended-product-placeholder__image" />
      <div className="recommended-product-placeholder__line recommended-product-placeholder__line--short" />
      <div className="recommended-product-placeholder__line" />
      <div className="recommended-product-placeholder__line recommended-product-placeholder__line--price" />
      <div className="recommended-product-placeholder__button" />
    </article>
  );
}
