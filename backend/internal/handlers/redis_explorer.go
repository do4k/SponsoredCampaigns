package handlers

import (
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"github.com/sponsors/campaigns/internal/database"
)

// RedisInfo returns Redis server info and memory stats
func RedisInfo(c *gin.Context) {
	ctx := database.Ctx

	// Get server info
	info, err := database.Rdb.Info(ctx).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get Redis info: " + err.Error()})
		return
	}

	// Parse key sections
	parsed := parseRedisInfo(info)

	// Get dbsize
	dbSize, err := database.Rdb.DBSize(ctx).Result()
	if err != nil {
		dbSize = -1
	}

	c.JSON(http.StatusOK, gin.H{
		"total_keys": dbSize,
		"memory":     parsed["memory"],
		"server":     parsed["server"],
		"stats":      parsed["stats"],
		"keyspace":   parsed["keyspace"],
	})
}

// RedisKeys scans for keys matching a pattern and returns their details
func RedisKeys(c *gin.Context) {
	ctx := database.Ctx
	pattern := c.DefaultQuery("pattern", "sponsors:*")
	cursor := uint64(0)
	limit := 200

	var allKeys []string
	for {
		keys, nextCursor, err := database.Rdb.Scan(ctx, cursor, pattern, int64(limit)).Result()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan keys: " + err.Error()})
			return
		}
		allKeys = append(allKeys, keys...)
		cursor = nextCursor
		if cursor == 0 || len(allKeys) >= limit {
			break
		}
	}

	sort.Strings(allKeys)

	// Truncate to limit
	if len(allKeys) > limit {
		allKeys = allKeys[:limit]
	}

	// Gather details for each key
	type KeyDetail struct {
		Key    string            `json:"key"`
		Type   string            `json:"type"`
		TTL    int64             `json:"ttl"`              // -1 = no expiry, -2 = key doesn't exist
		Size   int64             `json:"size"`             // number of elements (for hash/set/list) or string length
		Fields map[string]string `json:"fields,omitempty"` // for hash keys
	}

	details := make([]KeyDetail, 0, len(allKeys))
	pipeline := database.Rdb.Pipeline()

	// Batch type + ttl queries
	typeCmds := make([]*redis.StatusCmd, len(allKeys))
	ttlCmds := make([]*redis.DurationCmd, len(allKeys))
	for i, key := range allKeys {
		typeCmds[i] = pipeline.Type(ctx, key)
		ttlCmds[i] = pipeline.TTL(ctx, key)
	}
	pipeline.Exec(ctx)

	for i, key := range allKeys {
		keyType := typeCmds[i].Val()
		ttl := ttlCmds[i].Val().Milliseconds()

		detail := KeyDetail{
			Key:  key,
			Type: keyType,
			TTL:  ttl,
		}

		// Get size and optionally fields based on type
		switch keyType {
		case "hash":
			hlen, err := database.Rdb.HLen(ctx, key).Result()
			if err == nil {
				detail.Size = hlen
			}
			// For small hashes, include the field values
			if hlen <= 50 {
				fields, err := database.Rdb.HGetAll(ctx, key).Result()
				if err == nil {
					detail.Fields = fields
				}
			}
		case "set":
			scard, err := database.Rdb.SCard(ctx, key).Result()
			if err == nil {
				detail.Size = scard
			}
		case "list":
			llen, err := database.Rdb.LLen(ctx, key).Result()
			if err == nil {
				detail.Size = llen
			}
		case "string":
			strlen, err := database.Rdb.StrLen(ctx, key).Result()
			if err == nil {
				detail.Size = strlen
			}
		case "zset":
			zcard, err := database.Rdb.ZCard(ctx, key).Result()
			if err == nil {
				detail.Size = zcard
			}
		}

		details = append(details, detail)
	}

	c.JSON(http.StatusOK, gin.H{
		"pattern":   pattern,
		"count":     len(details),
		"truncated": len(allKeys) >= limit,
		"keys":      details,
	})
}

// RedisKeyDetail returns the full contents of a specific key
func RedisKeyDetail(c *gin.Context) {
	ctx := database.Ctx
	key := c.Query("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "key parameter is required"})
		return
	}

	keyType, err := database.Rdb.Type(ctx, key).Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get key type"})
		return
	}

	ttl, _ := database.Rdb.TTL(ctx, key).Result()
	memUsage, _ := database.Rdb.MemoryUsage(ctx, key).Result()

	result := gin.H{
		"key":          key,
		"type":         keyType,
		"ttl_ms":       ttl.Milliseconds(),
		"memory_bytes": memUsage,
	}

	switch keyType {
	case "hash":
		fields, err := database.Rdb.HGetAll(ctx, key).Result()
		if err == nil {
			result["fields"] = fields
			result["field_count"] = len(fields)
		}
	case "set":
		members, err := database.Rdb.SMembers(ctx, key).Result()
		if err == nil {
			result["members"] = members
			result["member_count"] = len(members)
		}
	case "list":
		values, err := database.Rdb.LRange(ctx, key, 0, 100).Result()
		if err == nil {
			result["values"] = values
			result["length"], _ = database.Rdb.LLen(ctx, key).Result()
		}
	case "string":
		val, err := database.Rdb.Get(ctx, key).Result()
		if err == nil {
			result["value"] = val
		}
	case "zset":
		members, err := database.Rdb.ZRangeWithScores(ctx, key, 0, 100).Result()
		if err == nil {
			result["members"] = members
			result["member_count"], _ = database.Rdb.ZCard(ctx, key).Result()
		}
	default:
		result["error"] = fmt.Sprintf("Unsupported key type: %s", keyType)
	}

	c.JSON(http.StatusOK, result)
}

// parseRedisInfo parses the Redis INFO output into sections
func parseRedisInfo(info string) map[string]map[string]string {
	result := make(map[string]map[string]string)
	currentSection := ""

	for _, line := range strings.Split(info, "\r\n") {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "#") {
			currentSection = strings.TrimSpace(strings.TrimPrefix(line, "#"))
			currentSection = strings.ToLower(currentSection)
			result[currentSection] = make(map[string]string)
			continue
		}
		if currentSection != "" {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				result[currentSection][parts[0]] = parts[1]
			}
		}
	}

	return result
}
