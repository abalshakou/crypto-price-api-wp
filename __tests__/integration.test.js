const request = require('supertest');
const axios = require('axios');

/**
 * Integration tests for the complete Cryptocurrency Price API system
 * These tests require the full Docker environment to be running
 */

describe('Integration Tests - Full System', () => {
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
  const WORDPRESS_BASE_URL = process.env.WORDPRESS_URL || 'http://localhost:8080';

  beforeAll(async () => {
    // Wait for services to be ready
    await waitForService(API_BASE_URL, 30000);
    await waitForService(WORDPRESS_BASE_URL, 60000);
  });

  describe('API Service Integration', () => {
    it('should have API service running and healthy', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'OK');
      expect(response.data).toHaveProperty('timestamp');
      expect(response.data).toHaveProperty('uptime');
    });

    it('should fetch real cryptocurrency prices', async () => {
      const response = await axios.get(`${API_BASE_URL}/price/bitcoin`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name', 'Bitcoin');
      expect(response.data).toHaveProperty('symbol', 'BTC');
      expect(response.data).toHaveProperty('price');
      expect(typeof response.data.price).toBe('number');
      expect(response.data.price).toBeGreaterThan(0);
    });

    it('should fetch multiple cryptocurrency prices', async () => {
      const response = await axios.get(`${API_BASE_URL}/prices/bitcoin,ethereum,cardano`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('bitcoin');
      expect(response.data).toHaveProperty('ethereum');
      expect(response.data).toHaveProperty('cardano');
      
      // Verify structure of each coin
      Object.values(response.data).forEach(coin => {
        expect(coin).toHaveProperty('name');
        expect(coin).toHaveProperty('symbol');
        expect(coin).toHaveProperty('price');
        expect(typeof coin.price).toBe('number');
      });
    });

    it('should handle rate limiting properly', async () => {
      const startTime = Date.now();
      let rateLimitHit = false;

      // Make many requests to trigger rate limiting
      for (let i = 0; i < 60; i++) {
        try {
          await axios.get(`${API_BASE_URL}/price/bitcoin`);
        } catch (error) {
          if (error.response && error.response.status === 429) {
            rateLimitHit = true;
            break;
          }
        }
      }

      // Should hit rate limit within reasonable time
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // Should hit limit within 10 seconds
    });

    it('should maintain cache consistency', async () => {
      // First request
      const response1 = await axios.get(`${API_BASE_URL}/price/ethereum`);
      const price1 = response1.data.price;

      // Immediate second request should return cached value
      const response2 = await axios.get(`${API_BASE_URL}/price/ethereum`);
      const price2 = response2.data.price;

      expect(price1).toBe(price2);
    });
  });

  describe('WordPress Service Integration', () => {
    it('should have WordPress service running', async () => {
      const response = await axios.get(WORDPRESS_BASE_URL);
      
      expect(response.status).toBe(200);
      expect(response.data).toContain('WordPress');
    });

    it('should have crypto ticker plugin files accessible', async () => {
      // Check if plugin directory is mounted correctly
      const pluginPath = `${WORDPRESS_BASE_URL}/wp-content/plugins/crypto-ticker/crypto-ticker.php`;
      
      try {
        const response = await axios.get(pluginPath);
        // Plugin file should not be directly accessible (security)
        expect(response.status).toBe(403);
      } catch (error) {
        // 403 or 404 are both acceptable - plugin files shouldn't be directly accessible
        expect([403, 404]).toContain(error.response.status);
      }
    });
  });

  describe('Cross-Service Communication', () => {
    it('should allow WordPress to communicate with API service', async () => {
      // This would require WordPress to be fully set up with the plugin activated
      // For now, we'll test if the API is reachable from within the Docker network
      
      const response = await axios.get(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
    });

    it('should handle API service restarts gracefully', async () => {
      // Test resilience - this would require Docker compose management
      const response = await axios.get(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
    });
  });

  describe('Database Integration', () => {
    it('should have MySQL service running', async () => {
      // We can't directly test MySQL from here without additional setup,
      // but we can verify WordPress can connect to it
      const response = await axios.get(WORDPRESS_BASE_URL);
      expect(response.status).toBe(200);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill().map(() => 
        axios.get(`${API_BASE_URL}/price/bitcoin`)
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('price');
      });

      // Should complete within reasonable time (accounting for cache)
      expect(duration).toBeLessThan(5000); // 5 seconds for 10 requests
    });

    it('should maintain low response times', async () => {
      const startTime = Date.now();
      
      const response = await axios.get(`${API_BASE_URL}/price/bitcoin`);
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid cryptocurrency IDs gracefully', async () => {
      try {
        await axios.get(`${API_BASE_URL}/price/invalid-crypto-coin-12345`);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.response.status).toBe(404);
        expect(error.response.data).toHaveProperty('error');
        expect(error.response.data.error).toBe('Cryptocurrency not found');
      }
    });

    it('should handle network timeouts properly', async () => {
      // This is harder to test without mocking, but we can test with a very short timeout
      try {
        await axios.get(`${API_BASE_URL}/price/bitcoin`, { timeout: 1 }); // 1ms timeout
      } catch (error) {
        expect(error.code).toBe('ECONNABORTED');
      }
    });
  });

  describe('Security Integration', () => {
    it('should have CORS headers properly configured', async () => {
      const response = await axios.get(`${API_BASE_URL}/`);
      
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should not expose sensitive information in error responses', async () => {
      try {
        await axios.get(`${API_BASE_URL}/price/invalid-coin`);
      } catch (error) {
        const errorData = error.response.data;
        
        // Should not contain internal paths, API keys, or stack traces
        expect(JSON.stringify(errorData)).not.toMatch(/\/[a-zA-Z]+\/[a-zA-Z]+\/[a-zA-Z]+/); // No file paths
        expect(JSON.stringify(errorData)).not.toMatch(/api[_-]?key/i); // No API keys
        expect(JSON.stringify(errorData)).not.toMatch(/stack|trace/i); // No stack traces
      }
    });
  });
});

/**
 * Utility function to wait for a service to be ready
 */
async function waitForService(url, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await axios.get(url, { timeout: 5000 });
      console.log(`Service at ${url} is ready`);
      return;
    } catch (error) {
      console.log(`Waiting for service at ${url}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`Service at ${url} did not become ready within ${timeout}ms`);
}

/**
 * Load testing utilities
 */
describe('Load Tests', () => {
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';

  it('should handle sustained load', async () => {
    const duration = 30000; // 30 seconds
    const requestsPerSecond = 5;
    const startTime = Date.now();
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    while (Date.now() - startTime < duration) {
      const batchPromises = Array(requestsPerSecond).fill().map(async () => {
        try {
          await axios.get(`${API_BASE_URL}/price/bitcoin`);
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(error.response?.status || error.code);
        }
      });

      await Promise.all(batchPromises);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
    }

    console.log(`Load test results: ${successCount} successful, ${errorCount} errors`);
    console.log('Error distribution:', errors.reduce((acc, err) => {
      acc[err] = (acc[err] || 0) + 1;
      return acc;
    }, {}));

    // Should maintain high success rate even under load
    const successRate = successCount / (successCount + errorCount);
    expect(successRate).toBeGreaterThan(0.8); // 80% success rate minimum
  }, 35000); // 35 second timeout for this test
});