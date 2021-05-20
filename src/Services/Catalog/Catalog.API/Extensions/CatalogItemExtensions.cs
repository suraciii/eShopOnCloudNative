using System;
namespace Microsoft.eShopOnContainers.Services.Catalog.API.Model
{
    public static class CatalogItemExtensions
    {
        public static void FillProductUrl(this CatalogItem item, string picBaseUrl, bool azureStorageEnabled)
        {
            if(string.IsNullOrEmpty(picBaseUrl))
                throw new ArgumentException("Should not be null or empty", nameof(picBaseUrl));
            if (item != null)
            {
                item.PictureUri = azureStorageEnabled
                    ? picBaseUrl + item.PictureFileName
                    : picBaseUrl.Replace("[0]", item.Id.ToString());
            }
        }
    }
}
