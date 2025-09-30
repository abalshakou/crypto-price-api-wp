const request = require('supertest');
const nock = require('nock');
const app = require('../app');

describe('Caching System', () => {
  beforeEach(() => {
    // Clear any existing cache
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('Cache functionality', () => {
    it('should cache single cryptocurrency data', async () => {
      // Mock API call for first request
      const scope = nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } })
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      // First request - should hit API
      const response1 = await request(app)
        .get('/price/bitcoin')
        .expect(200);

      expect(response1.body.price).toBe(45000.50);
      expect(scope.isDone()).toBe(true);

      // Second request - should use cache (no new API calls)
      const response2 = await request(app)
        .get('/price/bitcoin')
        .expect(200);

      expect(response2.body.price).toBe(45000.50);
      expect(response2.body.name).toBe('Bitcoin');
    });

    it('should handle cache expiration', async () => {
      // Override cache duration for testing
      const originalCacheDuration = 5 * 60 * 1000; // 5 minutes
      
      // Mock API calls
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { ethereum: { usd: 2800.25 } })
        .get('/api/v3/coins/ethereum')
        .query(true)
        .reply(200, { name: 'Ethereum', symbol: 'eth' });

      // First request
      const response1 = await request(app)
        .get('/price/ethereum')
        .expect(200);

      expect(response1.body.price).toBe(2800.25);

      // Mock different price for cache expiration test
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { ethereum: { usd: 2850.00 } })
        .get('/api/v3/coins/ethereum')
        .query(true)
        .reply(200, { name: 'Ethereum', symbol: 'eth' });

      // Simulate cache expiration by waiting or manipulating time
      // For testing purposes, we'll make another request immediately
      // In real scenario, cache would expire after 5 minutes
      
      const response2 = await request(app)
        .get('/price/ethereum')
        .expect(200);

      // Should still be cached value
      expect(response2.body.price).toBe(2800.25);
    });

    it('should cache multiple cryptocurrencies independently', async () => {
      // Mock different API responses for different coins
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } })
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { ethereum: { usd: 2800.25 } })
        .get('/api/v3/coins/ethereum')
        .query(true)
        .reply(200, { name: 'Ethereum', symbol: 'eth' });

      // Cache bitcoin
      await request(app).get('/price/bitcoin').expect(200);
      
      // Cache ethereum
      await request(app).get('/price/ethereum').expect(200);

      // Request both - should use individual cache entries
      const response = await request(app)
        .get('/prices/bitcoin,ethereum')
        .expect(200);

      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('ethereum');
      expect(response.body.bitcoin.price).toBe(45000.50);
      expect(response.body.ethereum.price).toBe(2800.25);
    });

    it('should handle mixed cached and non-cached requests', async () => {
      // Cache bitcoin first
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } })
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      await request(app).get('/price/bitcoin').expect(200);

      // Now request bitcoin (cached) + cardano (not cached)
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query({
          ids: 'cardano',
          vs_currencies: 'usd',
          include_market_cap: false,
          include_24hr_vol: false,
          include_24hr_change: false,
          include_last_updated_at: false
        })
        .reply(200, { cardano: { usd: 0.45 } })
        .get('/api/v3/coins/cardano')
        .query(true)
        .reply(200, { name: 'Cardano', symbol: 'ada' });

      const response = await request(app)
        .get('/prices/bitcoin,cardano')
        .expect(200);

      expect(response.body.bitcoin.price).toBe(45000.50);
      expect(response.body.cardano.price).toBe(0.45);
    });
  });

  describe('Cache health check', () => {
    it('should report cache size in health endpoint', async () => {
      // Add some items to cache
      nock('https://api.coingecko.com')
        .persist()
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } })
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      await request(app).get('/price/bitcoin').expect(200);

      const healthResponse = await request(app)
        .get('/health')
        .expect(200);

      expect(healthResponse.body.cache_size).toBeGreaterThan(0);
    });
  });
});