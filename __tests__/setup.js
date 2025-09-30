/**
 * Test setup and configuration
 */

// Global test configuration
global.console = {
  ...console,
  // Suppress console.log during tests unless explicitly needed
  log: process.env.VERBOSE_TESTS ? console.log : jest.fn(),
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Test timeout configuration
jest.setTimeout(30000);

// Mock external API calls by default
const nock = require('nock');

beforeEach(() => {
  // Clean up any existing nock interceptors
  nock.cleanAll();
});

afterEach(() => {
  // Ensure all mocks are cleaned up
  nock.cleanAll();
});

// Global test utilities
global.testUtils = {
  /**
   * Create a mock CoinGecko price response
   */
  mockCoinGeckoPrice: (coinId, price = 1000) => {
    return nock('https://api.coingecko.com')
      .get('/api/v3/simple/price')
      .query(true)
      .reply(200, {
        [coinId]: { usd: price }
      });
  },

  /**
   * Create a mock CoinGecko coin info response
   */
  mockCoinGeckoInfo: (coinId, name = 'Test Coin', symbol = 'TEST') => {
    return nock('https://api.coingecko.com')
      .get(`/api/v3/coins/${coinId}`)
      .query(true)
      .reply(200, {
        name: name,
        symbol: symbol
      });
  },

  /**
   * Create a complete mock for a cryptocurrency
   */
  mockCompleteCoin: (coinId, price = 1000, name = 'Test Coin', symbol = 'TEST') => {
    const priceScope = global.testUtils.mockCoinGeckoPrice(coinId, price);
    const infoScope = global.testUtils.mockCoinGeckoInfo(coinId, name, symbol);
    return { priceScope, infoScope };
  },

  /**
   * Wait for a specified amount of time
   */
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate random cryptocurrency data for testing
   */
  generateRandomCoinData: () => {
    const coins = ['bitcoin', 'ethereum', 'cardano', 'polkadot', 'chainlink'];
    const names = ['Bitcoin', 'Ethereum', 'Cardano', 'Polkadot', 'Chainlink'];
    const symbols = ['BTC', 'ETH', 'ADA', 'DOT', 'LINK'];
    
    const index = Math.floor(Math.random() * coins.length);
    
    return {
      id: coins[index],
      name: names[index],
      symbol: symbols[index],
      price: Math.random() * 50000 + 100 // Random price between 100 and 50100
    };
  }
};

// Environment-specific setup
if (process.env.NODE_ENV === 'test') {
  // Disable external network calls during unit tests
  nock.disableNetConnect();
  
  // Allow localhost connections for integration tests
  nock.enableNetConnect(/^(127\.0\.0\.1|localhost)/);
}