const request = require('supertest');
const nock = require('nock');
const app = require('../app');

describe('Cryptocurrency Price API', () => {
  afterEach(() => {
    nock.cleanAll();
  });

  describe('GET /', () => {
    it('should return API information', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('usage');
      expect(response.body).toHaveProperty('examples');
      expect(response.body.message).toBe('Cryptocurrency Price API');
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('cache_size');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /price/:id', () => {
    it('should return cryptocurrency price for valid ID', async () => {
      // Mock CoinGecko API responses
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query({
          ids: 'bitcoin',
          vs_currencies: 'usd',
          include_market_cap: false,
          include_24hr_vol: false,
          include_24hr_change: false,
          include_last_updated_at: false
        })
        .reply(200, {
          bitcoin: { usd: 45000.50 }
        });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/bitcoin')
        .query({
          localization: false,
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
          sparkline: false
        })
        .reply(200, {
          name: 'Bitcoin',
          symbol: 'btc'
        });

      const response = await request(app)
        .get('/price/bitcoin')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Bitcoin');
      expect(response.body).toHaveProperty('symbol', 'BTC');
      expect(response.body).toHaveProperty('price', 45000.50);
    });

    it('should return 404 for invalid cryptocurrency ID', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, {});

      const response = await request(app)
        .get('/price/invalid-coin')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Cryptocurrency not found');
      expect(response.body).toHaveProperty('message');
    });

    it('should handle API timeout', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .replyWithError({ code: 'ECONNABORTED' });

      const response = await request(app)
        .get('/price/bitcoin')
        .expect(408);

      expect(response.body).toHaveProperty('error', 'Request timeout');
    });

    it('should handle rate limiting from external API', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(429, { error: 'Rate limit exceeded' });

      const response = await request(app)
        .get('/price/bitcoin')
        .expect(429);

      expect(response.body).toHaveProperty('error', 'Rate limit exceeded');
    });

    it('should use cache for repeated requests', async () => {
      // First request
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { ethereum: { usd: 2800.25 } });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/ethereum')
        .query(true)
        .reply(200, { name: 'Ethereum', symbol: 'eth' });

      await request(app)
        .get('/price/ethereum')
        .expect(200);

      // Second request should use cache (no new nock calls)
      const response = await request(app)
        .get('/price/ethereum')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Ethereum');
      expect(response.body).toHaveProperty('symbol', 'ETH');
      expect(response.body).toHaveProperty('price', 2800.25);
    });
  });

  describe('GET /prices/:ids', () => {
    it('should return multiple cryptocurrency prices', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query({
          ids: 'bitcoin,ethereum',
          vs_currencies: 'usd',
          include_market_cap: false,
          include_24hr_vol: false,
          include_24hr_change: false,
          include_last_updated_at: false
        })
        .reply(200, {
          bitcoin: { usd: 45000.50 },
          ethereum: { usd: 2800.25 }
        });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/ethereum')
        .query(true)
        .reply(200, { name: 'Ethereum', symbol: 'eth' });

      const response = await request(app)
        .get('/prices/bitcoin,ethereum')
        .expect(200);

      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('ethereum');
      expect(response.body.bitcoin).toHaveProperty('price', 45000.50);
      expect(response.body.ethereum).toHaveProperty('price', 2800.25);
    });

    it('should handle mixed cached and fresh data', async () => {
      // Pre-populate cache for bitcoin
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      await request(app).get('/price/bitcoin');

      // Now request bitcoin,cardano - bitcoin should come from cache
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
        .reply(200, { cardano: { usd: 0.45 } });

      nock('https://api.coingecko.com')
        .get('/api/v3/coins/cardano')
        .query(true)
        .reply(200, { name: 'Cardano', symbol: 'ada' });

      const response = await request(app)
        .get('/prices/bitcoin,cardano')
        .expect(200);

      expect(response.body).toHaveProperty('bitcoin');
      expect(response.body).toHaveProperty('cardano');
      expect(response.body.bitcoin.price).toBe(45000.50);
      expect(response.body.cardano.price).toBe(0.45);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Mock successful responses for rate limit testing
      nock('https://api.coingecko.com')
        .persist()
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, { bitcoin: { usd: 45000.50 } });

      nock('https://api.coingecko.com')
        .persist()
        .get('/api/v3/coins/bitcoin')
        .query(true)
        .reply(200, { name: 'Bitcoin', symbol: 'btc' });

      // Make 51 requests rapidly (exceeding the 50/minute limit)
      const requests = Array(51).fill().map(() => 
        request(app).get('/price/bitcoin')
      );

      const responses = await Promise.all(requests);
      
      // Some responses should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .replyWithError('Network error');

      const response = await request(app)
        .get('/price/bitcoin')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    it('should handle invalid JSON responses', async () => {
      nock('https://api.coingecko.com')
        .get('/api/v3/simple/price')
        .query(true)
        .reply(200, 'invalid json');

      const response = await request(app)
        .get('/price/bitcoin')
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Internal server error');
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS requests', async () => {
      const response = await request(app)
        .options('/price/bitcoin')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toContain('GET');
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('*');
    });
  });
});