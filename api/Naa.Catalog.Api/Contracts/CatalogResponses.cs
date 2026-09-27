namespace Naa.Catalog.Api.Contracts;

public sealed record DirectionResponse(string Slug, string Name, string SelectionLabel);

public sealed record CategoryResponse(string Slug, string Name, string Url, int SortOrder);

public sealed record DirectionHomeResponse(
    string Slug,
    string Name,
    string SelectionLabel,
    IReadOnlyCollection<CategoryResponse> Categories);

public sealed record OfferResponse(
    string SupplierCode,
    string SupplierName,
    decimal UnitPrice,
    string Currency,
    int AvailableQuantity,
    int DeliveryDays,
    DateTimeOffset UpdatedAt);

public sealed record ProductResponse(
    Guid Id,
    string Manufacturer,
    string Article,
    string Name,
    string CategoryUrl,
    IReadOnlyCollection<OfferResponse> Offers);
