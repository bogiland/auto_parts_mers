namespace Naa.Catalog.Api.Domain;

public sealed class CatalogDirection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string SelectionLabel { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<CatalogCategory> Categories { get; set; } = new List<CatalogCategory>();
}

public sealed class CatalogCategory
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DirectionId { get; set; }
    public CatalogDirection Direction { get; set; } = null!;
    public Guid? ParentId { get; set; }
    public CatalogCategory? Parent { get; set; }
    public ICollection<CatalogCategory> Children { get; set; } = new List<CatalogCategory>();
    public string Slug { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int SortOrder { get; set; }
    public bool IsVisible { get; set; } = true;
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public sealed class Manufacturer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string NormalizedName { get; set; } = string.Empty;
    public ICollection<Product> Products { get; set; } = new List<Product>();
}

public sealed class Product
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ManufacturerId { get; set; }
    public Manufacturer Manufacturer { get; set; } = null!;
    public Guid CategoryId { get; set; }
    public CatalogCategory Category { get; set; } = null!;
    public string Article { get; set; } = string.Empty;
    public string NormalizedArticle { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<SupplierOffer> Offers { get; set; } = new List<SupplierOffer>();
    public ICollection<ProductFitment> Fitments { get; set; } = new List<ProductFitment>();
}

public sealed class Supplier
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? ApiBaseUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public ICollection<SupplierOffer> Offers { get; set; } = new List<SupplierOffer>();
    public ICollection<SupplierSyncRun> SyncRuns { get; set; } = new List<SupplierSyncRun>();
}

public sealed class SupplierOffer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public string ExternalOfferId { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public string Currency { get; set; } = "MDL";
    public int AvailableQuantity { get; set; }
    public int DeliveryDays { get; set; }
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public bool IsAvailable { get; set; } = true;
}

public sealed class VehicleModel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Brand { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string BodyCode { get; set; } = string.Empty;
    public ICollection<ProductFitment> Fitments { get; set; } = new List<ProductFitment>();
}

public sealed class ProductFitment
{
    public Guid ProductId { get; set; }
    public Product Product { get; set; } = null!;
    public Guid VehicleModelId { get; set; }
    public VehicleModel VehicleModel { get; set; } = null!;
}

public sealed class SupplierSyncRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SupplierId { get; set; }
    public Supplier Supplier { get; set; } = null!;
    public DateTimeOffset StartedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? FinishedAt { get; set; }
    public string Status { get; set; } = "running";
    public int ImportedOffers { get; set; }
    public string? Error { get; set; }
}
