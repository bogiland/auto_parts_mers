# NAA Catalog API

ASP.NET Core 8 API for catalogue directions, category trees, products and supplier offers.

## Local start

```powershell
dotnet run --project api/Naa.Catalog.Api --urls http://localhost:5079
```

Without `ConnectionStrings__Catalog`, the API uses an in-memory store and seeds three directions: `legkovye`, `avtohimiya`, `gruzovye`.

```powershell
Invoke-RestMethod http://localhost:5079/health
Invoke-RestMethod http://localhost:5079/api/directions
Invoke-RestMethod http://localhost:5079/api/directions/legkovye/home
```

## Postgres / Supabase

The production provider is PostgreSQL. Set the connection string before starting the API:

```powershell
$env:ConnectionStrings__Catalog = "Host=localhost;Port=5432;Database=naa_catalog;Username=postgres;Password=change-me"
dotnet ef migrations add InitialCatalog --project api/Naa.Catalog.Api
dotnet ef database update --project api/Naa.Catalog.Api
```

For Supabase, use its direct PostgreSQL connection string in `ConnectionStrings__Catalog`. Supplier credentials must stay in a secret store; `suppliers.ApiBaseUrl` deliberately stores only a non-secret endpoint.

## Data model rules

- `products` means a manufacturer/article pair. `normalized_article` is indexed and unique together with the manufacturer.
- `supplier_offers` owns price, quantity, delivery time and the supplier's external offer ID.
- `catalog_directions` is the root of every independent catalogue. Categories form a parent/child tree within one direction.
- Fitment is a separate optional product-to-vehicle relation, so a product without model compatibility remains sellable.
- Banners, posts and service pages remain content-system concerns, not catalogue rows.
