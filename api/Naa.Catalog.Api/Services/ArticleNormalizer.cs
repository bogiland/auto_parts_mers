namespace Naa.Catalog.Api.Services;

public sealed class ArticleNormalizer
{
    public string Normalize(string article)
    {
        if (string.IsNullOrWhiteSpace(article))
        {
            throw new ArgumentException("Артикул не может быть пустым.", nameof(article));
        }

        var normalized = new string(article
            .Where(char.IsLetterOrDigit)
            .Select(char.ToUpperInvariant)
            .ToArray());

        if (normalized.Length == 0)
        {
            throw new ArgumentException("Артикул должен содержать буквы или цифры.", nameof(article));
        }

        return normalized;
    }
}
