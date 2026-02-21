package handlers

import (
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"github.com/sponsors/campaigns/internal/database"
	"github.com/sponsors/campaigns/internal/models"
	"github.com/sponsors/campaigns/internal/services"
	"strconv"
)

// CreateCampaign handles the creation of a new campaign
func CreateCampaign(c *gin.Context) {
	var campaign models.Campaign
	if err := c.ShouldBindJSON(&campaign); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate DeliveryAreas mutual exclusivity
	for _, area := range campaign.DeliveryAreas {
		if area == "*" && len(campaign.DeliveryAreas) > 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot select both '*' and specific delivery areas"})
			return
		}
	}

	campaign.ID = uuid.New().String()
	campaign.CreatedAt = time.Now()

	// 1. Save to PostgreSQL
	if result := database.Db.Create(&campaign); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}

	// 2. Calculate Permutations and Write to Redis
	if err := services.SyncCampaignToRedis(&campaign); err != nil {
		log.Printf("Error syncing campaign to Redis: %v", err)
	}

	c.JSON(http.StatusCreated, campaign)
}

func GetCampaigns(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	
	if page < 1 { page = 1 }
	if limit < 1 { limit = 10 }
	if limit > 100 { limit = 100 }

	offset := (page - 1) * limit

	var campaigns []models.Campaign
	var total int64

	// Get total count
	database.Db.Model(&models.Campaign{}).Count(&total)

	// Get paginated results
	if result := database.Db.Order("created_at desc").Offset(offset).Limit(limit).Find(&campaigns); result.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": result.Error.Error()})
		return
	}
	
	totalPages := (int(total) + limit - 1) / limit

	c.JSON(http.StatusOK, gin.H{
		"data": campaigns,
		"meta": gin.H{
			"current_page": page,
			"per_page":     limit,
			"total_items":  total,
			"total_pages":  totalPages,
		},
	})
}

func UpdateCampaign(c *gin.Context) {
	id := c.Param("id")
	var existing models.Campaign
	
	if err := database.Db.First(&existing, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}
	
	// Remove from Redis (simple implementation: iterate old config and remove)
	services.RemoveCampaignFromRedis(&existing)
	
	var updateData models.Campaign
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	// Validate DeliveryAreas mutual exclusivity
	for _, area := range updateData.DeliveryAreas {
		if area == "*" && len(updateData.DeliveryAreas) > 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot select both '*' and specific delivery areas"})
			return
		}
	}

	// Apply updates
	existing.BidPrice = updateData.BidPrice
	existing.DeliveryAreas = updateData.DeliveryAreas
	existing.TimeOfDay = updateData.TimeOfDay
	existing.PartnerID = updateData.PartnerID // allowed to change? assume yes
	
	if err := database.Db.Save(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	services.SyncCampaignToRedis(&existing)
	
	c.JSON(http.StatusOK, existing)
}

func DeleteCampaign(c *gin.Context) {
	id := c.Param("id")
	var existing models.Campaign
	
	if err := database.Db.First(&existing, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}
	
	services.RemoveCampaignFromRedis(&existing)
	
	if err := database.Db.Delete(&existing).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{"status": "deleted"})
}

func SeedCampaigns(c *gin.Context) {
	type SeedRequest struct {
		Count int `json:"count"`
	}
	var req SeedRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Count = 10 // default
	}
	
	if req.Count > 1000 {
		req.Count = 1000 // limit
	}
	
	go func(n int) {
		rand.Seed(time.Now().UnixNano())

		for i := 0; i < n; i++ {
			pid := uuid.New().String()[:8] // random partner
			
			// Random Delivery Areas
			var deliveryAreas pq.StringArray
			if rand.Float32() < 0.1 { // 10% chance for ALL areas
				deliveryAreas = []string{"*"}
			} else {
				numAreas := rand.Intn(5) + 1 // 1 to 5 areas
				areaSet := make(map[string]bool)
				for len(areaSet) < numAreas {
					area := fmt.Sprintf("BS%d", rand.Intn(20)+1) // BS1 to BS20
					areaSet[area] = true
				}
				for area := range areaSet {
					deliveryAreas = append(deliveryAreas, area)
				}
			}

			// Random Time of Day
			var timeOfDay pq.StringArray
			numTimes := rand.Intn(len(models.TimeBuckets)) + 1
			permTimes := rand.Perm(len(models.TimeBuckets))
			for j := 0; j < numTimes; j++ {
				timeOfDay = append(timeOfDay, models.TimeBuckets[permTimes[j]])
			}

			// Random Days of Week
			var daysOfWeek pq.StringArray
			numDays := rand.Intn(len(models.Days)) + 1
			permDays := rand.Perm(len(models.Days))
			for j := 0; j < numDays; j++ {
				daysOfWeek = append(daysOfWeek, models.Days[permDays[j]])
			}

			camp := models.Campaign{
				ID: uuid.New().String(),
				CreatedAt: time.Now(),
				CreatedBy: "seed@generator.com",
				PartnerID: pid,
				BidPrice: 100 + rand.Intn(900), // 100 to 1000
				DeliveryAreas: deliveryAreas,
				TimeOfDay: timeOfDay,
				DaysOfWeek: daysOfWeek,
			}
			
			// Just insert directly for speed
			database.Db.Create(&camp)
			services.SyncCampaignToRedis(&camp)
		}
		log.Printf("Seeded %d campaigns", n)
	}(req.Count)
	
	c.JSON(http.StatusAccepted, gin.H{"status": "seeding started", "count": req.Count})
}

// CheckSponsored checks if partners have active campaigns for a given area and current time
func CheckSponsored(c *gin.Context) {
	var req models.CheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	start := time.Now()
	result, currentTimeBucket, err := services.CheckSponsoredLogic(&req)
	elapsed := time.Since(start)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Redis error"})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"active_partners": result,
		"meta": gin.H{
			"time_bucket": currentTimeBucket,
			"checked_area": req.DeliveryArea,
			"server_processing_ms": float64(elapsed.Microseconds()) / 1000.0,
		},
	})
}
