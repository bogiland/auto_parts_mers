using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Naa.Catalog.Api.Contracts;
using Naa.Catalog.Api.Data;
using Naa.Catalog.Api.Domain;
using Naa.Catalog.Api.Services;

namespace Naa.Catalog.Api.Controllers;

[ApiController]
[Route("api")]
public sealed class CatalogController(CatalogDbContext db, ArticleNormalizer articleNormalizer) : ControllerBase
{
    [HttpGet("directions")]
    public async Task<IReadOnlyCollection<DirectionResponse>> GetDirections(CancellationToken cancellationToken) =>
        await db.Directions.AsNoTracking()
            .Where(direction => direction.IsActive)
            .OrderBy(direction => direction.Name)
            .Select(direction => new DirectionResponse(direction.Slug, direction.Name, direction.SelectionLabel))
            .ToListAsync(cancellationToken);

    [HttpGet("directions/{directionSlug}/home")]
    public async Task<ActionResult<DirectionHomeResponse>> GetDirectionHome(string directionSlug, CancellationToken cancellationToken)
    {
        var direction = await db.Directions.AsNoTracking()
            .Where(item => item.Slug == directionSlug && item.IsActive)
            .Select(item => new { item.Slug, item.Name, item.SelectionLabel, item.Id })
            .SingleOrDefaultAsync(cancellationToken);

        if (direction is null) return NotFound();

        var categories = await db.Categories.AsNoTracking()
            .Where(category => category.DirectionId == direction.Id && category.ParentId == null && category.IsVisible)
            .OrderBy(category => category.SortOrder)
            .Select(category => new CategoryResponse(
                category.Slug,
                category.Name,
                $"/catalog/{directionSlug}/{category.Slug}",
                category.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(new DirectionHomeResponse(direction.Slug, direction.Name, direction.SelectionLabel, categories));
    }

    [HttpGet("catalog/{directionSlug}/{**categoryPath}")]
    public async Task<ActionResult<IReadOnlyCollection<CategoryResponse>>> GetCategoryChildren(
        string directionSlug,
        string? categoryPath,
        CancellationToken cancellationToken)
    {
        var direction = await db.Directions.AsNoTracking()
            .SingleOrDefaultAsync(item => item.Slug == directionSlug && item.IsActive, cancellationToken);
        if (direction is null) return NotFound();

        CatalogCategory? current = null;
        foreach (var segment in SplitPath(categoryPath))
        {
            current = await db.Categories.AsNoTracking().SingleOrDefaultAsync(category =>
                category.DirectionId == direction.Id &&
                category.ParentId == (current == null ? null : current.Id) &&
                category.Slug == segment &&
                category.IsVisible, cancellationToken);

            if (current is null) return NotFound();
        }

        var parentId = current?.Id;
        var basePath = string.IsNullOrWhiteSpace(categoryPath)
            ? $"/catalog/{directionSlug}"
            : $"/catalog/{directionSlug}/{categoryPath.Trim('/')}";

        var children = await db.Categories.AsNoTracking()
            .Where(category => category.DirectionId == direction.Id && category.ParentId == parentId && category.IsVisible)
            .OrderBy(category => category.SortOrder)
            .Select(category => new CategoryResponse(category.Slug, category.Name, $"{basePath}/{category.Slug}", category.SortOrder))
            .ToListAsync(cancellationToken);

        return Ok(children);
    }

    [HttpGet("products")]
    public async Task<ActionResult<IReadOnlyCollection<ProductResponse>>> SearchProducts(
        [FromQuery] string article,
        CancellationToken cancellationToken)
    {
        string normalizedArticle;
        try
        {
            normalizedArticle = articleNormalizer.Normalize(article);
        }
        catch (ArgumentException exception)
        {
            return ValidationProblem(new ValidationProblemDetails(new Dictionary<string, string[]> { ["article"] = [exception.Message] }));
        }

        var products = await db.Products.AsNoTracking()
            .Where(product => product.NormalizedArticle == normalizedArticle && product.IsActive)
            .Include(product => product.Manufacturer)
            .Include(product => product.Category).ThenInclude(category => category.Direction)
            .Include(product => product.Offers.Where(offer => offer.IsAvailable)).ThenInclude(offer => offer.Supplier)
            .ToListAsync(cancellationToken);

        return Ok(products.Select(ToProductResponse).ToList());
    }

    [HttpGet("products/{id:guid}/offers")]
    public async Task<ActionResult<IReadOnlyCollection<OfferResponse>>> GetProductOffers(Guid id, CancellationToken cancellationToken)
    {
        var offers = await db.SupplierOffers.AsNoTracking()
            .Where(offer => offer.ProductId == id && offer.IsAvailable && offer.Supplier.IsActive)
            .OrderBy(offer => offer.UnitPrice)
            .Include(offer => offer.Supplier)
            .Select(offer => new OfferResponse(
                offer.Supplier.Code,
                offer.Supplier.Name,
                offer.UnitPrice,
                offer.Currency,
                offer.AvailableQuantity,
                offer.DeliveryDays,
                offer.UpdatedAt))
            .ToListAsync(cancellationToken);

        return offers.Count == 0 ? NotFound() : Ok(offers);
    }

    private static ProductResponse ToProductResponse(Product product) => new(
        product.Id,
        product.Manufacturer.Name,
        product.Article,
        product.Name,
        $"/catalog/{product.Category.Direction.Slug}/{product.Category.Slug}",
        product.Offers
            .Where(offer => offer.IsAvailable && offer.Supplier.IsActive)
            .OrderBy(offer => offer.UnitPrice)
            .Select(offer => new OfferResponse(offer.Supplier.Code, offer.Supplier.Name, offer.UnitPrice, offer.Currency, offer.AvailableQuantity, offer.DeliveryDays, offer.UpdatedAt))
            .ToList());

    private static IEnumerable<string> SplitPath(string? categoryPath) =>
        (categoryPath ?? string.Empty)
            .Split('/', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
}
