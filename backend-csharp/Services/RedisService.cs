using StackExchange.Redis;
using SponsoredCampaignsApi.Models;

namespace SponsoredCampaignsApi.Services;

public class RedisService
{
    private readonly IConnectionMultiplexer _redis;
    private readonly IDatabase _db;
    
    private static readonly string[] TimeBuckets = { "early-hours", "breakfast", "lunch", "dinner" };
    private static readonly string[] Days = { "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday" };

    public RedisService(IConnectionMultiplexer redis)
    {
        _redis = redis;
        _db = redis.GetDatabase();
    }

    public async Task<CheckResponse> CheckSponsoredLogicAsync(CheckRequest request)
    {
        // 1. Determine current Time of Day bucket
        var now = DateTime.Now;
        var currentTimeBucket = GetCurrentTimeBucket(now);
        var currentDay = now.DayOfWeek.ToString().ToLower();

        // 2. Base keys
        var keyPrefix = "sponsors:h";
        var keyPrefixCarousel = "sponsors:h:carousel";

        // 3. Construct regular keys
        var keySpecific = $"{keyPrefix}:{currentDay}:{currentTimeBucket}:{request.DeliveryArea}";
        var keyWildcard = $"{keyPrefix}:{currentDay}:{currentTimeBucket}:*";

        // 4. Construct carousel keys (if needed)
        string? keySpecificCarousel = null;
        string? keyWildcardCarousel = null;
        if (request.IncludeCarousel)
        {
            keySpecificCarousel = $"{keyPrefixCarousel}:{currentDay}:{currentTimeBucket}:{request.DeliveryArea}";
            keyWildcardCarousel = $"{keyPrefixCarousel}:{currentDay}:{currentTimeBucket}:*";
        }

        // 5. Use HMGET to fetch ONLY the requested partners
        var batch = _db.CreateBatch();
        
        var partnerIds = request.PartnerIDs.Select(p => (RedisValue)p).ToArray();
        
        // Always check regular (sponsors:h)
        var specificResultsTask = batch.HashGetAsync(keySpecific, partnerIds);
        var wildcardResultsTask = batch.HashGetAsync(keyWildcard, partnerIds);
        
        // Check carousel only if requested
        Task<RedisValue[]>? specificResultsCarouselTask = null;
        Task<RedisValue[]>? wildcardResultsCarouselTask = null;
        
        if (request.IncludeCarousel && keySpecificCarousel != null && keyWildcardCarousel != null)
        {
            specificResultsCarouselTask = batch.HashGetAsync(keySpecificCarousel, partnerIds);
            wildcardResultsCarouselTask = batch.HashGetAsync(keyWildcardCarousel, partnerIds);
        }
        
        batch.Execute();
        
        // 6. Process results
        var specificResults = await specificResultsTask;
        var wildcardResults = await wildcardResultsTask;
        
        RedisValue[]? specificResultsCarousel = null;
        RedisValue[]? wildcardResultsCarousel = null;
        
        if (request.IncludeCarousel && specificResultsCarouselTask != null && wildcardResultsCarouselTask != null)
        {
            specificResultsCarousel = await specificResultsCarouselTask;
            wildcardResultsCarousel = await wildcardResultsCarouselTask;
        }
        
        var activePartners = new HashSet<string>();
        
        for (int i = 0; i < request.PartnerIDs.Count; i++)
        {
            var pid = request.PartnerIDs[i];
            
            // Check regular
            if (specificResults[i].HasValue || wildcardResults[i].HasValue)
            {
                activePartners.Add(pid);
                continue; // Found in regular, so they are sponsored regardless of carousel check
            }
            
            // Check carousel (if enabled in request)
            if (request.IncludeCarousel && specificResultsCarousel != null && wildcardResultsCarousel != null)
            {
                if (specificResultsCarousel[i].HasValue || wildcardResultsCarousel[i].HasValue)
                {
                    activePartners.Add(pid);
                }
            }
        }

        return new CheckResponse
        {
            ActivePartners = activePartners.ToList(),
            TimeBucket = currentTimeBucket,
            CheckedArea = request.DeliveryArea
        };
    }

    private static string GetCurrentTimeBucket(DateTime time)
    {
        var hour = time.Hour;
        
        return hour switch
        {
            >= 5 and < 11 => "breakfast",
            >= 11 and < 15 => "lunch",
            >= 15 and < 22 => "dinner",
            _ => "early-hours" // 22:00 - 05:00
        };
    }
}
