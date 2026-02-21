package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sponsors/campaigns/internal/database"
	"github.com/sponsors/campaigns/internal/models"
)

var ctx = context.Background()

func SyncCampaignToRedis(c *models.Campaign) error {
	pipeline := database.Rdb.Pipeline()
	times := c.TimeOfDay
	for _, t := range times {
		if t == "all-day" {
			times = models.TimeBuckets
			break
		}
	}
	
	days := c.DaysOfWeek
	if len(days) == 0 {
		days = models.Days // Backwards compatibility: all days
	}

	for _, day := range days {
		for _, t := range times {
			for _, area := range c.DeliveryAreas {
				key := fmt.Sprintf("sponsors:h:%s:%s:%s", strings.ToLower(day), t, area)
				// Using HSet to store partnerID as field and '1' as value. 
				// In future we could store the full JSON payload here.
				pipeline.HSet(ctx, key, c.PartnerID, "1")
			}
		}
	}
	_, err := pipeline.Exec(ctx)
	return err
}

func RemoveCampaignFromRedis(c *models.Campaign) {
	pipeline := database.Rdb.Pipeline()
	times := c.TimeOfDay
	for _, t := range times {
		if t == "all-day" {
			times = models.TimeBuckets
			break
		}
	}
	
	days := c.DaysOfWeek
	if len(days) == 0 {
		days = models.Days
	}

	for _, day := range days {
		for _, t := range times {
			for _, area := range c.DeliveryAreas {
				key := fmt.Sprintf("sponsors:h:%s:%s:%s", strings.ToLower(day), t, area)
				pipeline.HDel(ctx, key, c.PartnerID)
			}
		}
	}
	pipeline.Exec(ctx)
}

func CheckSponsoredLogic(req *models.CheckRequest) ([]string, string, error) {
	// 1. Determine current Time of Day bucket
	now := time.Now()
	currentTimeBucket := GetCurrentTimeBucket(now)
	currentDay := strings.ToLower(now.Weekday().String())

	// 2. Construct Redis Keys (Using Hash prefix 'sponsors:h')
	keySpecific := fmt.Sprintf("sponsors:h:%s:%s:%s", currentDay, currentTimeBucket, req.DeliveryArea)
	keyWildcard := fmt.Sprintf("sponsors:h:%s:%s:*", currentDay, currentTimeBucket)

	// 3. Use HMGet to fetch ONLY the requested partners
	// This is O(N) where N is number of requested partners, NOT total active partners.
	pipeline := database.Rdb.Pipeline()
	
	// Convert partner IDs to interface{} slice for variadic function
	args := make([]string, len(req.PartnerIDs))
	for i, v := range req.PartnerIDs {
		args[i] = v
	}
	
	pipeline.HMGet(ctx, keySpecific, args...)
	pipeline.HMGet(ctx, keyWildcard, args...)
	
	cmds, err := pipeline.Exec(ctx)
	if err != nil {
		return nil, "", err
	}
	
	// 4. Process results
	// HMGet returns a slice of values. If a field exists, the value is returned (non-nil).
	// If it doesn't exist, nil is returned.
	
	specificResults := cmds[0].(*redis.SliceCmd).Val()
	wildcardResults := cmds[1].(*redis.SliceCmd).Val()
	
	activePartners := make(map[string]bool)
	
	for i, pid := range req.PartnerIDs {
		// Check specific area match
		if specificResults[i] != nil {
			activePartners[pid] = true
			continue 
		}
		// Check wildcard match
		if wildcardResults[i] != nil {
			activePartners[pid] = true
		}
	}

	// 5. Convert map to list
	result := []string{}
	for pid := range activePartners {
		result = append(result, pid)
	}

	return result, currentTimeBucket, nil
}

func GetCurrentTimeBucket(t time.Time) string {
	hour := t.Hour()
	
	switch {
	case hour >= 5 && hour < 11:
		return "breakfast"
	case hour >= 11 && hour < 15:
		return "lunch"
	case hour >= 15 && hour < 22:
		return "dinner"
	default:
		return "early-hours" // 22:00 - 05:00
	}
}

func WarmupCache() {
	log.Println("Warming up cache from DB...")
	var campaigns []models.Campaign
	// Process in batches if needed, but for now fetch all
	if result := database.Db.Find(&campaigns); result.Error != nil {
		log.Printf("Error fetching campaigns for warmup: %v", result.Error)
		return
	}

	pipeline := database.Rdb.Pipeline()
	count := 0
	
	// Flush existing keys? Maybe safer not to, or yes to ensure consistency.
	// For this simple example, we just add. Ideally we'd clear relevant keys first.
	
	for _, c := range campaigns {
		times := c.TimeOfDay
		for _, t := range times {
			if t == "all-day" {
				times = models.TimeBuckets
				break
			}
		}

		days := c.DaysOfWeek
		if len(days) == 0 {
			days = models.Days
		}

		for _, day := range days {
			for _, t := range times {
				for _, area := range c.DeliveryAreas {
					key := fmt.Sprintf("sponsors:h:%s:%s:%s", strings.ToLower(day), t, area)
					pipeline.HSet(ctx, key, c.PartnerID, "1")
					count++
				}
			}
		}
	}
	
	if count > 0 {
		if _, err := pipeline.Exec(ctx); err != nil {
			log.Printf("Error executing warmup pipeline: %v", err)
		}
	}
	log.Printf("Cache warmed up with %d entries from %d campaigns", count, len(campaigns))
}
