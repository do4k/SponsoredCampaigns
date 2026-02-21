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

				// If carousel boost is enabled, duplicate to carousel specific key
				if c.CarouselBoost {
					keyCarousel := fmt.Sprintf("sponsors:h:carousel:%s:%s:%s", strings.ToLower(day), t, area)
					pipeline.HSet(ctx, keyCarousel, c.PartnerID, "1")
				}
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

				// Always try to remove from carousel key too, just in case
				keyCarousel := fmt.Sprintf("sponsors:h:carousel:%s:%s:%s", strings.ToLower(day), t, area)
				pipeline.HDel(ctx, keyCarousel, c.PartnerID)
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

	// 2. Base keys
	keyPrefix := "sponsors:h"
	keyPrefixCarousel := "sponsors:h:carousel"

	// 3. Construct regular keys
	keySpecific := fmt.Sprintf("%s:%s:%s:%s", keyPrefix, currentDay, currentTimeBucket, req.DeliveryArea)
	keyWildcard := fmt.Sprintf("%s:%s:%s:*", keyPrefix, currentDay, currentTimeBucket)
	
	// 4. Construct carousel keys (if needed)
	var keySpecificCarousel, keyWildcardCarousel string
	if req.IncludeCarousel {
		keySpecificCarousel = fmt.Sprintf("%s:%s:%s:%s", keyPrefixCarousel, currentDay, currentTimeBucket, req.DeliveryArea)
		keyWildcardCarousel = fmt.Sprintf("%s:%s:%s:*", keyPrefixCarousel, currentDay, currentTimeBucket)
	}

	// 5. Use HMGet to fetch ONLY the requested partners
	pipeline := database.Rdb.Pipeline()
	
	args := make([]string, len(req.PartnerIDs))
	for i, v := range req.PartnerIDs {
		args[i] = v
	}
	
	// Always Check regular (sponsors:h)
	// This ensures that even if a partner has a carousel boost, they are still found
	// when searching for regular sponsorship.
	// Partners with CarouselBoost are stored in BOTH 'sponsors:h' and 'sponsors:h:carousel'
	pipeline.HMGet(ctx, keySpecific, args...)
	pipeline.HMGet(ctx, keyWildcard, args...)
	
	// Check carousel only if requested
	if req.IncludeCarousel {
		pipeline.HMGet(ctx, keySpecificCarousel, args...)
		pipeline.HMGet(ctx, keyWildcardCarousel, args...)
	}
	
	cmds, err := pipeline.Exec(ctx)
	if err != nil {
		return nil, "", err
	}
	
	// 6. Process results
	specificResults := cmds[0].(*redis.SliceCmd).Val()
	wildcardResults := cmds[1].(*redis.SliceCmd).Val()
	
	var specificResultsCarousel []interface{}
	var wildcardResultsCarousel []interface{}
	
	if req.IncludeCarousel {
		specificResultsCarousel = cmds[2].(*redis.SliceCmd).Val()
		wildcardResultsCarousel = cmds[3].(*redis.SliceCmd).Val()
	}
	
	activePartners := make(map[string]bool)
	
	for i, pid := range req.PartnerIDs {
		// Check regular
		if specificResults[i] != nil || wildcardResults[i] != nil {
			activePartners[pid] = true
			continue // Found in regular, so they are sponsored regardless of carousel check
		}
		// Check carousel (if enabled in request)
		// Note: Partners with CarouselBoost are usually in both keys, so the check above catches them.
		// But this is here for completeness if logic changes.
		if req.IncludeCarousel {
			if specificResultsCarousel[i] != nil || wildcardResultsCarousel[i] != nil {
				activePartners[pid] = true
			}
		}
	}

	// 7. Convert map to list
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
					
					// If carousel boost is enabled, duplicate to carousel specific key
					if c.CarouselBoost {
						keyCarousel := fmt.Sprintf("sponsors:h:carousel:%s:%s:%s", strings.ToLower(day), t, area)
						pipeline.HSet(ctx, keyCarousel, c.PartnerID, "1")
					}
					
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
