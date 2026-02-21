package models

import (
	"time"

	"github.com/lib/pq"
)

// Campaign defines the structure for a sponsored campaign
type Campaign struct {
	ID            string         `gorm:"primaryKey" json:"id"`
	CreatedAt     time.Time      `json:"created_at"`
	CreatedBy     string         `json:"created_by"`     // e.g. "dev@takeaway.com"
	PartnerID     string         `json:"partner_id"`     // e.g. "123"
	BidPrice      int            `json:"bid_price"`      // e.g. 500 (cents)
	DeliveryAreas pq.StringArray `gorm:"type:text[]" json:"delivery_areas"` // e.g. ["bs1", "bs2"] or ["*"]
	TimeOfDay     pq.StringArray `gorm:"type:text[]" json:"time_of_day"`    // e.g. ["breakfast", "lunch"] or ["all-day"]
	DaysOfWeek    pq.StringArray `gorm:"type:text[]" json:"days_of_week"`   // e.g. ["monday", "friday"]
	CarouselBoost bool           `json:"carousel_boost"`                    // New field for premium boost
}

// CheckRequest defines the structure for the sponsored check API
type CheckRequest struct {
	DeliveryArea string   `json:"delivery_area" binding:"required"`
	PartnerIDs   []string `json:"partner_ids" binding:"required"`
	IncludeCarousel bool  `json:"include_carousel"` // Request to fetch carousel boosted partners
}

// TimeBuckets defines the available time slots
var TimeBuckets = []string{"early-hours", "breakfast", "lunch", "dinner"}

// Days defines the available days of the week
var Days = []string{"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"}
