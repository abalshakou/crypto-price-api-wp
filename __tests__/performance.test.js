const request = require('supertest');
const nock = require('nock');
const app = require('../api/app');

describe('Performance Tests', () => {
  beforeEach(() => {
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Response Time Tests', () => {
    it('should respond to health check within 100ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/health')
        .expect(200);
        
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(100);
    });

    it('should respond to root endpoint within 50ms', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/')
        .expect(200);
        
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(50);
    });

    it('should respond to cached price requests within 50ms', async () => {
      // Setup mock for initial request
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');

      // First request to populate cache
      await request(app)
        .get('/price/bitcoin')
        .expect(200);

      // Second request should be fast (cached)
      const startTime = Date.now();
      
      await request(app)
        .get('/price/bitcoin')
        .expect(200);
        
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(50);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not create memory leaks with repeated requests', async () => {
      global.testUtils.mockCompleteCoin('ethereum', 2800, 'Ethereum', 'ETH');

      const initialMemory = process.memoryUsage().heapUsed;

      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await request(app)
          .get('/price/ethereum')
          .expect(200);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should manage cache size efficiently', async () => {
      // Create many different cryptocurrency requests to test cache management
      const coins = ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'chainlink', 
                    'litecoin', 'dogecoin', 'stellar', 'ripple', 'monero'];

      // Mock all coins
      coins.forEach((coin, index) => {
        global.testUtils.mockCompleteCoin(coin, 1000 + index, `Coin ${index}`, `C${index}`);
      });

      // Make requests for all coins
      for (const coin of coins) {
        await request(app)
          .get(`/price/${coin}`)
          .expect(200);
      }

      // Check cache size via health endpoint
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.cache_size).toBe(coins.length);
    });
  });

  describe('Concurrency Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');

      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill().map(() =>
        request(app).get('/price/bitcoin').expect(200)
      );

      const responses = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      expect(responses).toHaveLength(concurrentRequests);
      
      // Should complete within reasonable time (2 seconds for 20 requests)
      expect(totalTime).toBeLessThan(2000);

      // All responses should have the same data (cache consistency)
      const firstResponse = responses[0].body;
      responses.forEach(response => {
        expect(response.body).toEqual(firstResponse);
      });
    });

    it('should handle mixed endpoint concurrent requests', async () => {
      // Mock multiple coins
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');
      global.testUtils.mockCompleteCoin('ethereum', 2800, 'Ethereum', 'ETH');
      global.testUtils.mockCompleteCoin('cardano', 0.45, 'Cardano', 'ADA');

      const requests = [
        () => request(app).get('/price/bitcoin'),
        () => request(app).get('/price/ethereum'),
        () => request(app).get('/prices/bitcoin,ethereum'),
        () => request(app).get('/price/cardano'),
        () => request(app).get('/health'),
        () => request(app).get('/')
      ];

      const startTime = Date.now();
      
      const promises = requests.map(requestFn => requestFn().expect(200));
      await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(3000);
    });
  });

  describe('Load Tests', () => {
    it('should maintain performance under sustained load', async () => {
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');

      const loadTestDuration = 5000; // 5 seconds
      const requestsPerSecond = 10;
      const startTime = Date.now();
      
      let successCount = 0;
      let errorCount = 0;
      const responseTimes = [];

      while (Date.now() - startTime < loadTestDuration) {
        const batchStartTime = Date.now();
        
        const batchPromises = Array(requestsPerSecond).fill().map(async () => {
          const reqStartTime = Date.now();
          try {
            await request(app).get('/price/bitcoin').expect(200);
            responseTimes.push(Date.now() - reqStartTime);
            successCount++;
          } catch (error) {
            errorCount++;
          }
        });

        await Promise.all(batchPromises);
        
        // Wait for the rest of the second
        const batchDuration = Date.now() - batchStartTime;
        if (batchDuration < 1000) {
          await new Promise(resolve => setTimeout(resolve, 1000 - batchDuration));
        }
      }

      // Calculate performance metrics
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      const successRate = successCount / (successCount + errorCount);

      console.log(`Load test results:
        - Success rate: ${(successRate * 100).toFixed(2)}%
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Max response time: ${maxResponseTime}ms
        - Total requests: ${successCount + errorCount}`);

      // Performance assertions
      expect(successRate).toBeGreaterThan(0.95); // 95% success rate
      expect(averageResponseTime).toBeLessThan(100); // Average under 100ms
      expect(maxResponseTime).toBeLessThan(500); // Max under 500ms
    }, 10000); // 10 second timeout

    it('should handle rate limiting gracefully under load', async () => {
      global.testUtils.mockCompleteCoin('ethereum', 2800, 'Ethereum', 'ETH');

      const rapidRequests = 60; // Exceed rate limit of 50/minute
      let rateLimitHits = 0;
      let successfulRequests = 0;

      const promises = Array(rapidRequests).fill().map(async () => {
        try {
          await request(app).get('/price/ethereum').expect(200);
          successfulRequests++;
        } catch (error) {
          if (error.status === 429) {
            rateLimitHits++;
          }
        }
      });

      await Promise.allSettled(promises);

      // Should hit rate limit
      expect(rateLimitHits).toBeGreaterThan(0);
      
      // But some requests should still succeed
      expect(successfulRequests).toBeGreaterThan(0);
      
      // Total should equal our request count
      expect(rateLimitHits + successfulRequests).toBe(rapidRequests);
    });
  });

  describe('Stress Tests', () => {
    it('should handle large bulk requests efficiently', async () => {
      // Mock 50 different cryptocurrencies
      const coins = Array(50).fill().map((_, i) => `coin${i}`);
      
      coins.forEach((coin, index) => {
        global.testUtils.mockCompleteCoin(coin, 1000 + index, `Coin ${index}`, `C${index}`);
      });

      const bulkRequest = coins.join(',');
      const startTime = Date.now();

      const response = await request(app)
        .get(`/prices/${bulkRequest}`)
        .expect(200);

      const responseTime = Date.now() - startTime;

      // Should handle 50 coins efficiently
      expect(responseTime).toBeLessThan(5000); // Under 5 seconds
      expect(Object.keys(response.body)).toHaveLength(50);
    });

    it('should maintain stability with invalid mixed requests', async () => {
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');

      const mixedRequests = [
        '/price/bitcoin',
        '/price/invalid-coin-123',
        '/prices/bitcoin,ethereum',
        '/prices/invalid1,invalid2',
        '/health',
        '/nonexistent-endpoint'
      ];

      let successCount = 0;
      let clientErrorCount = 0;
      let serverErrorCount = 0;

      for (const endpoint of mixedRequests) {
        try {
          const response = await request(app).get(endpoint);
          if (response.status >= 200 && response.status < 300) {
            successCount++;
          } else if (response.status >= 400 && response.status < 500) {
            clientErrorCount++;
          }
        } catch (error) {
          if (error.status >= 400 && error.status < 500) {
            clientErrorCount++;
          } else {
            serverErrorCount++;
          }
        }
      }

      // Should handle errors gracefully without server errors
      expect(serverErrorCount).toBe(0);
      expect(successCount + clientErrorCount).toBe(mixedRequests.length);
    });
  });

  describe('Cache Performance Tests', () => {
    it('should show significant performance improvement with cache', async () => {
      global.testUtils.mockCompleteCoin('cardano', 0.45, 'Cardano', 'ADA');

      // First request (cold cache)
      const coldStartTime = Date.now();
      await request(app).get('/price/cardano').expect(200);
      const coldTime = Date.now() - coldStartTime;

      // Second request (warm cache)
      const warmStartTime = Date.now();
      await request(app).get('/price/cardano').expect(200);
      const warmTime = Date.now() - warmStartTime;

      // Cache should provide significant speedup
      expect(warmTime).toBeLessThan(coldTime * 0.5); // At least 50% faster
      expect(warmTime).toBeLessThan(50); // Cached requests under 50ms
    });

    it('should handle cache misses efficiently in bulk requests', async () => {
      // Pre-cache some coins
      global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');
      global.testUtils.mockCompleteCoin('ethereum', 2800, 'Ethereum', 'ETH');
      await request(app).get('/price/bitcoin').expect(200);

      // Now request mix of cached and uncached
      global.testUtils.mockCompleteCoin('cardano', 0.45, 'Cardano', 'ADA');

      const startTime = Date.now();
      const response = await request(app)
        .get('/prices/bitcoin,ethereum,cardano') // bitcoin cached, ethereum and cardano not
        .expect(200);
      const responseTime = Date.now() - startTime;

      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('ethereum');
      expect(response.body).toHaveProperty('cardano');
      
      // Should still be reasonably fast
      expect(responseTime).toBeLessThan(2000);
    });
  });
});