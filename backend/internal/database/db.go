package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/sponsors/campaigns/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	Rdb *redis.Client
	Db  *gorm.DB
	Ctx = context.Background()
)

func InitDB() {
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
		os.Getenv("DB_HOST"),
		os.Getenv("DB_USER"),
		os.Getenv("DB_PASSWORD"),
		os.Getenv("DB_NAME"),
		os.Getenv("DB_PORT"),
	)

	var err error
	// Retry connection logic for Docker startup
	for i := 0; i < 5; i++ {
		Db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
		if err == nil {
			break
		}
		log.Printf("Failed to connect to database, retrying in 2s... (%d/5)", i+1)
		time.Sleep(2 * time.Second)
	}

	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Migrate the schema
	Db.AutoMigrate(&models.Campaign{})
}

func InitRedis() {
	Rdb = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", os.Getenv("REDIS_HOST"), os.Getenv("REDIS_PORT")),
	})

	_, err := Rdb.Ping(Ctx).Result()
	if err != nil {
		log.Fatal("Failed to connect to Redis:", err)
	}
}
