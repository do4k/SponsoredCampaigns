using System.Text.Json.Serialization;

namespace SponsoredCampaignsApi.Models;

public class CheckRequest
{
    [JsonPropertyName("delivery_area")]
    public string DeliveryArea { get; set; } = string.Empty;

    [JsonPropertyName("partner_ids")]
    public List<string> PartnerIDs { get; set; } = new();

    [JsonPropertyName("include_carousel")]
    public bool IncludeCarousel { get; set; }
}

public class CheckResponse
{
    public List<string> ActivePartners { get; set; } = new();
    public string TimeBucket { get; set; } = string.Empty;
    public string CheckedArea { get; set; } = string.Empty;
    public double ServerProcessingMs { get; set; }
}
