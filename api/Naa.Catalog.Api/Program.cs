using Microsoft.EntityFrameworkCore;
using Naa.Catalog.Api.Data;
using Naa.Catalog.Api.Services;

var builder = WebApplication.CreateBuilder(args);
var connectionString = builder.Configuration.GetConnectionString("Catalog");

builder.Services.AddDbContext<CatalogDbContext>(options =>
{
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        options.UseInMemoryDatabase("naa-catalog-development");
        return;
    }

    options.UseNpgsql(connectionString);
});

builder.Services.AddCors(options => options.AddPolicy("web", policy =>
    policy.WithOrigins("http://localhost:3000")
        .AllowAnyHeader()
        .AllowAnyMethod()));
builder.Services.AddControllers();
builder.Services.AddScoped<ArticleNormalizer>();

var app = builder.Build();

app.UseCors("web");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapControllers();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<CatalogDbContext>();
    await CatalogSeeder.SeedAsync(db);
}

app.Run();

public partial class Program;
