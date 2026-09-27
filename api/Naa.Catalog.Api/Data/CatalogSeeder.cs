using Microsoft.EntityFrameworkCore;
using Naa.Catalog.Api.Domain;

namespace Naa.Catalog.Api.Data;

public static class CatalogSeeder
{
    public static async Task SeedAsync(CatalogDbContext db)
    {
        if (await db.Directions.AnyAsync()) return;

        var directions = new[]
        {
            new CatalogDirection { Slug = "legkovye", Name = "Легковые запчасти", SelectionLabel = "Подбор запчастей для легковых авто" },
            new CatalogDirection { Slug = "avtohimiya", Name = "Автохимия и масла", SelectionLabel = "Подбор масла и автохимии" },
            new CatalogDirection { Slug = "gruzovye", Name = "Грузовые запчасти", SelectionLabel = "Подбор запчастей для грузовых авто" },
        };

        var categories = new[]
        {
            ("legkovye", "tormoza", "Тормозная система"),
            ("legkovye", "dvigatel", "Двигатель и компоненты"),
            ("legkovye", "podveska", "Подвеска и рулевое управление"),
            ("avtohimiya", "masla", "Моторные масла"),
            ("avtohimiya", "tehnicheskie-zhidkosti", "Технические жидкости"),
            ("avtohimiya", "ochistiteli", "Очистители и уход"),
            ("gruzovye", "tormoznaya-sistema", "Тормозная система"),
            ("gruzovye", "dvigatel", "Двигатель и компоненты"),
            ("gruzovye", "podveska", "Подвеска и ходовая"),
        };

        db.Directions.AddRange(directions);
        db.Categories.AddRange(categories.Select((category, index) => new CatalogCategory
        {
            DirectionId = directions.Single(direction => direction.Slug == category.Item1).Id,
            Slug = category.Item2,
            Name = category.Item3,
            SortOrder = index,
        }));
        await db.SaveChangesAsync();
    }
}
