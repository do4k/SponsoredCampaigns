package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/sponsors/campaigns/internal/database"
	"github.com/sponsors/campaigns/internal/handlers"
	"github.com/sponsors/campaigns/internal/services"
)

func main() {
	// Initialize Database and Redis connections
	database.InitDB()
	database.InitRedis()

	// Warmup Cache from DB
	go services.WarmupCache()

	r := gin.Default()

	// API Routes
	api := r.Group("/api")
	{
		api.GET("/campaigns", handlers.GetCampaigns)
		api.POST("/campaigns", handlers.CreateCampaign)
		api.PUT("/campaigns/:id", handlers.UpdateCampaign)
		api.DELETE("/campaigns/:id", handlers.DeleteCampaign)
		api.POST("/campaigns/seed", handlers.SeedCampaigns)
		api.POST("/sponsored/check", handlers.CheckSponsored)
	}
	
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	r.Run(":" + port)
}
