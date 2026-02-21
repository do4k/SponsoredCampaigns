using StackExchange.Redis;
using SponsoredCampaignsApi.Models;
using SponsoredCampaignsApi.Services;
using System.Diagnostics;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddOpenApi();

// Configure Redis
var redisHost = builder.Configuration["Redis:Host"] ?? "localhost";
var redisPort = builder.Configuration["Redis:Port"] ?? "6379";
var redisConnectionString = $"{redisHost}:{redisPort}";

builder.Services.AddSingleton<IConnectionMultiplexer>(sp =>
{
    var configuration = ConfigurationOptions.Parse(redisConnectionString);
    configuration.AbortOnConnectFail = false;
    return ConnectionMultiplexer.Connect(configuration);
});

builder.Services.AddSingleton<RedisService>();

// Add CORS for testing
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors();

// Health check endpoint
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// Main Redis read endpoint - matches the Go API
app.MapPost("/api/sponsored/check", async (CheckRequest request, RedisService redisService) =>
{
    if (string.IsNullOrEmpty(request.DeliveryArea))
    {
        return Results.BadRequest(new { error = "delivery_area is required" });
    }

    if (request.PartnerIDs == null || request.PartnerIDs.Count == 0)
    {
        return Results.BadRequest(new { error = "partner_ids is required" });
    }

    try
    {
        var sw = Stopwatch.StartNew();
        var result = await redisService.CheckSponsoredLogicAsync(request);
        sw.Stop();

        var serverProcessingMs = sw.Elapsed.TotalMicroseconds / 1000.0;

        return Results.Ok(new
        {
            active_partners = result.ActivePartners,
            meta = new
            {
                time_bucket = result.TimeBucket,
                checked_area = request.DeliveryArea,
                server_processing_ms = serverProcessingMs
            }
        });
    }
    catch (Exception ex)
    {
        return Results.Problem(
            detail: ex.Message,
            statusCode: 500
        );
    }
})
.WithName("CheckSponsored");

Console.WriteLine($"Starting server on port {builder.Configuration["PORT"] ?? "8081"}");
Console.WriteLine($"Redis connection: {redisConnectionString}");

app.Run();

