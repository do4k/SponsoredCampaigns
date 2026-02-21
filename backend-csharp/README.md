# C# vs Go API Performance Comparison

This directory contains a C# minimal API implementation that mirrors the Go backend's Redis read endpoint for performance comparison.

## Architecture

The C# API implements the same Redis-based sponsored partner lookup logic as the Go backend:

### Key Files
- `Program.cs` - Minimal API setup with `/api/sponsored/check` endpoint
- `Services/RedisService.cs` - Redis operations matching Go's `CheckSponsoredLogic`
- `Models/CheckRequest.cs` - Request/response models

### Key Differences from Go Implementation
1. **Redis Client**: Uses StackExchange.Redis instead of go-redis
2. **Async/Await**: C# uses async patterns (`Task<T>`, `async/await`)
3. **Batching**: Uses `IDatabase.CreateBatch()` instead of pipelines

## Running the API

### Option 1: Docker Compose (Recommended)
```bash
# From the project root
docker-compose up backend-csharp
```

The C# API will be available at `http://localhost:8081`

### Option 2: Local Development
```bash
cd backend-csharp
dotnet run
```

Make sure Redis is running locally on port 6379.

## Testing the Endpoint

### Health Check
```bash
curl http://localhost:8081/health
```

### Sponsored Check Endpoint
```bash
curl -X POST http://localhost:8081/api/sponsored/check \
  -H "Content-Type: application/json" \
  -d '{
    "delivery_area": "BS1",
    "partner_ids": ["partner-1", "partner-2", "partner-3"],
    "include_carousel": true
  }'
```

Expected response:
```json
{
  "sponsored_partners": ["partner-1"],
  "time_bucket": "lunch"
}
```

## Performance Comparison

### Using Go's Load Test Endpoint

The Go backend has a built-in load testing endpoint. To compare:

1. Start both services:
```bash
docker-compose up backend backend-csharp
```

2. Seed some data via the Go backend:
```bash
curl -X POST http://localhost:8080/api/campaigns/seed
```

3. Run load test against Go (port 8080):
```bash
curl -X POST http://localhost:8080/api/loadtest/start \
  -H "Content-Type: application/json" \
  -d '{"rps": 1000, "duration": 30}'

# Check results
curl http://localhost:8080/api/loadtest/status
```

### Manual Performance Testing

Use tools like Apache Bench, wrk, or k6:

#### Using Apache Bench (ab)
```bash
# Test Go backend
ab -n 10000 -c 100 -T application/json \
  -p test-payload.json \
  http://localhost:8080/api/sponsored/check

# Test C# backend
ab -n 10000 -c 100 -T application/json \
  -p test-payload.json \
  http://localhost:8081/api/sponsored/check
```

Create `test-payload.json`:
```json
{
  "delivery_area": "BS1",
  "partner_ids": ["partner-1", "partner-2", "partner-3"],
  "include_carousel": true
}
```

#### Using wrk
```bash
# Test Go backend
wrk -t4 -c100 -d30s --latency \
  -s post.lua \
  http://localhost:8080/api/sponsored/check

# Test C# backend
wrk -t4 -c100 -d30s --latency \
  -s post.lua \
  http://localhost:8081/api/sponsored/check
```

Create `post.lua`:
```lua
wrk.method = "POST"
wrk.body   = '{"delivery_area":"BS1","partner_ids":["partner-1","partner-2","partner-3"],"include_carousel":true}'
wrk.headers["Content-Type"] = "application/json"
```

## Expected Metrics to Compare

1. **Average Latency** - Mean response time
2. **P99 Latency** - 99th percentile response time
3. **Throughput** - Requests per second
4. **CPU Usage** - Monitor with `docker stats`
5. **Memory Usage** - Monitor with `docker stats`

## Architecture Notes

### Redis Operations
Both implementations use the same Redis strategy:
- Hash-based storage with keys: `sponsors:h:{day}:{timebucket}:{area}`
- HMGET operations to batch-fetch multiple partner IDs
- Pipelined/batched Redis commands for efficiency

### Time Bucket Logic
Both use identical time bucket calculations:
- `breakfast`: 05:00-11:00
- `lunch`: 11:00-15:00
- `dinner`: 15:00-22:00
- `early-hours`: 22:00-05:00

## Performance Considerations

### Go Advantages
- Lower memory footprint
- Faster startup time
- More efficient garbage collection
- Native concurrency with goroutines

### C# Advantages
- Mature async/await patterns
- Rich ecosystem and tooling
- Strong type system
- Enterprise support

## Production Optimization Tips

### C# Optimizations
1. Enable server GC: Add `<ServerGarbageCollection>true</ServerGarbageCollection>` to .csproj
2. Use ReadyToRun compilation for faster startup
3. Consider using `System.Text.Json` source generators
4. Profile with dotnet-trace and dotnet-counters

### Go Optimizations
1. Already well-optimized by default
2. Consider using `GOMAXPROCS` for CPU tuning
3. Profile with pprof

## Monitoring

Both services expose health endpoints:
- Go: `GET http://localhost:8080/api/campaigns`
- C#: `GET http://localhost:8081/health`

Monitor with:
```bash
docker stats backend backend-csharp
```
