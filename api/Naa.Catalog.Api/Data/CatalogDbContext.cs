using Microsoft.EntityFrameworkCore;
using Naa.Catalog.Api.Domain;

namespace Naa.Catalog.Api.Data;

public sealed class CatalogDbContext(DbContextOptions<CatalogDbContext> options) : DbContext(options)
{
    public DbSet<CatalogDirection> Directions => Set<CatalogDirection>();
    public DbSet<CatalogCategory> Categories => Set<CatalogCategory>();
    public DbSet<Manufacturer> Manufacturers => Set<Manufacturer>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Supplier> Suppliers => Set<Supplier>();
    public DbSet<SupplierOffer> SupplierOffers => Set<SupplierOffer>();
    public DbSet<VehicleModel> VehicleModels => Set<VehicleModel>();
    public DbSet<ProductFitment> ProductFitments => Set<ProductFitment>();
    public DbSet<SupplierSyncRun> SupplierSyncRuns => Set<SupplierSyncRun>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CatalogDirection>(entity =>
        {
            entity.ToTable("catalog_directions");
            entity.HasIndex(x => x.Slug).IsUnique();
            entity.Property(x => x.Slug).HasMaxLength(80);
            entity.Property(x => x.Name).HasMaxLength(160);
        });

        modelBuilder.Entity<CatalogCategory>(entity =>
        {
            entity.ToTable("catalog_categories");
            entity.HasIndex(x => new { x.DirectionId, x.ParentId, x.Slug }).IsUnique();
            entity.Property(x => x.Slug).HasMaxLength(100);
            entity.Property(x => x.Name).HasMaxLength(180);
            entity.HasOne(x => x.Parent).WithMany(x => x.Children).HasForeignKey(x => x.ParentId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(x => x.Direction).WithMany(x => x.Categories).HasForeignKey(x => x.DirectionId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Manufacturer>(entity =>
        {
            entity.ToTable("manufacturers");
            entity.HasIndex(x => x.NormalizedName).IsUnique();
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.NormalizedName).HasMaxLength(160);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.ToTable("products");
            entity.HasIndex(x => new { x.ManufacturerId, x.NormalizedArticle }).IsUnique();
            entity.HasIndex(x => x.NormalizedArticle);
            entity.Property(x => x.Article).HasMaxLength(120);
            entity.Property(x => x.NormalizedArticle).HasMaxLength(120);
            entity.Property(x => x.Name).HasMaxLength(320);
        });

        modelBuilder.Entity<Supplier>(entity =>
        {
            entity.ToTable("suppliers");
            entity.HasIndex(x => x.Code).IsUnique();
            entity.Property(x => x.Code).HasMaxLength(60);
            entity.Property(x => x.Name).HasMaxLength(160);
        });

        modelBuilder.Entity<SupplierOffer>(entity =>
        {
            entity.ToTable("supplier_offers");
            entity.HasIndex(x => new { x.SupplierId, x.ExternalOfferId }).IsUnique();
            entity.HasIndex(x => new { x.ProductId, x.IsAvailable, x.UnitPrice });
            entity.Property(x => x.ExternalOfferId).HasMaxLength(160);
            entity.Property(x => x.Currency).HasMaxLength(3);
            entity.Property(x => x.UnitPrice).HasPrecision(18, 2);
        });

        modelBuilder.Entity<VehicleModel>(entity =>
        {
            entity.ToTable("vehicle_models");
            entity.HasIndex(x => new { x.Brand, x.BodyCode }).IsUnique();
            entity.Property(x => x.Brand).HasMaxLength(100);
            entity.Property(x => x.Name).HasMaxLength(160);
            entity.Property(x => x.BodyCode).HasMaxLength(50);
        });

        modelBuilder.Entity<ProductFitment>(entity =>
        {
            entity.ToTable("product_fitments");
            entity.HasKey(x => new { x.ProductId, x.VehicleModelId });
        });

        modelBuilder.Entity<SupplierSyncRun>(entity =>
        {
            entity.ToTable("supplier_sync_runs");
            entity.HasIndex(x => new { x.SupplierId, x.StartedAt });
            entity.Property(x => x.Status).HasMaxLength(30);
        });
    }
}
