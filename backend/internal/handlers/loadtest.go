package handlers

import (
	"math/rand"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sponsors/campaigns/internal/models"
	"github.com/sponsors/campaigns/internal/services"
)

type LoadTestConfig struct {
	RPS      int `json:"rps"`      // Requests per second target
	Duration int `json:"duration"` // Duration in seconds
}

type LoadTestResult struct {
	Timestamp int64   `json:"timestamp"`   // Unix timestamp
	AvgLatency float64 `json:"avg_latency"` // Average latency in ms
	P99Latency float64 `json:"p99_latency"` // 99th percentile latency in ms
	Requests   int     `json:"requests"`    // Number of requests in this second
	Errors     int     `json:"errors"`      // Number of errors
}

var (
	loadTestMutex  sync.Mutex
	isTestRunning  bool
	currentResults []LoadTestResult
	stopTestChan   chan bool
)

// StartLoadTest initiates a load test
func StartLoadTest(c *gin.Context) {
	var config LoadTestConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	loadTestMutex.Lock()
	if isTestRunning {
		loadTestMutex.Unlock()
		c.JSON(http.StatusConflict, gin.H{"error": "Test already running"})
		return
	}
	isTestRunning = true
	currentResults = []LoadTestResult{}
	stopTestChan = make(chan bool)
	loadTestMutex.Unlock()

	// Start the test in a goroutine
	go runLoadTest(config)

	c.JSON(http.StatusAccepted, gin.H{"status": "Load test started", "config": config})
}

// StopLoadTest stops the current test
func StopLoadTest(c *gin.Context) {
	loadTestMutex.Lock()
	defer loadTestMutex.Unlock()

	if isTestRunning {
		close(stopTestChan)
		isTestRunning = false
	} 
	
	c.JSON(http.StatusOK, gin.H{"status": "Test stopped"})
}

// GetLoadTestStatus returns current metrics
func GetLoadTestStatus(c *gin.Context) {
	loadTestMutex.Lock()
	defer loadTestMutex.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"running": isTestRunning,
		"results": currentResults,
	})
}

func runLoadTest(config LoadTestConfig) {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	// Ensure we stop after duration
	go func() {
		time.Sleep(time.Duration(config.Duration) * time.Second)
		loadTestMutex.Lock()
		if isTestRunning {
			close(stopTestChan)
			isTestRunning = false
		}
		loadTestMutex.Unlock()
	}()

	for {
		select {
		case <-stopTestChan:
			return
		case t := <-ticker.C:
			// Burst logic here (simplified)
			var wg sync.WaitGroup
			latencies := make([]float64, 0, config.RPS)
			errors := 0
			mu := sync.Mutex{}

			for i := 0; i < config.RPS; i++ {
				wg.Add(1)
				go func() {
					defer wg.Done()
					
					// Random inputs
					areas := []string{"BS1", "BS2", "BS3", "London", "Paris"}
					area := areas[rand.Intn(len(areas))]
					pids := []string{uuid.New().String(), uuid.New().String(), uuid.New().String()}
					
					req := &models.CheckRequest{
						DeliveryArea: area,
						PartnerIDs:   pids,
						IncludeCarousel: rand.Float32() < 0.5,
					}
					
					start := time.Now()
					_, _, err := services.CheckSponsoredLogic(req)
					elapsed := time.Since(start).Seconds() * 1000 // ms
					
					mu.Lock()
					if err != nil {
						errors++
					} else {
						latencies = append(latencies, elapsed)
					}
					mu.Unlock()
				}()
			}
			wg.Wait()
			
			// Stats
			var total float64
			var max float64
			for _, l := range latencies {
				total += l
				if l > max {
					max = l
				}
			}
			avg := 0.0
			if len(latencies) > 0 {
				avg = total / float64(len(latencies))
			}
			
			loadTestMutex.Lock()
			currentResults = append(currentResults, LoadTestResult{
				Timestamp:  t.Unix(),
				AvgLatency: avg,
				P99Latency: max, // using max as proxy for p99 in this simple implementation
				Requests:   len(latencies),
				Errors:     errors,
			})
			loadTestMutex.Unlock()
		}
	}
}
