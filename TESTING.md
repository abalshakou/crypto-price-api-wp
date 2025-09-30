# Testing Documentation

This document provides comprehensive information about testing the Cryptocurrency Price API project.

## Test Overview

The project includes multiple types of tests to ensure quality and reliability:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test service interactions and API endpoints
- **Performance Tests**: Measure response times and load handling
- **End-to-End Tests**: Test complete user workflows
- **WordPress Plugin Tests**: Test plugin functionality and integration

## Test Structure

```
├── api/
│   └── __tests__/
│       ├── app.test.js           # API unit tests
│       └── cache.test.js         # Cache functionality tests
├── wordpress-plugin/
│   └── crypto-ticker/
│       └── __tests__/
│           └── plugin.test.php   # WordPress plugin tests
├── __tests__/
│   ├── setup.js                  # Test configuration and utilities
│   ├── integration.test.js       # Full system integration tests
│   ├── performance.test.js       # Performance and load tests
│   └── e2e.test.js              # End-to-end browser tests
├── scripts/
│   └── run-tests.sh             # Test runner script
└── docker-compose.test.yml      # Test environment configuration
```

## Prerequisites

### Required
- Node.js 14+ 
- npm
- Git

### Optional (for full testing)
- Docker & Docker Compose (for integration/E2E tests)
- PHPUnit (for WordPress plugin tests)
- Puppeteer dependencies (for E2E tests)

## Quick Start

### Install Dependencies
```bash
# Install root dependencies
npm install

# Install API dependencies
cd api && npm install && cd ..
```

### Run All Tests
```bash
# Quick unit tests only
npm test

# Run all test types
./scripts/run-tests.sh --all

# Run with coverage
./scripts/run-tests.sh --coverage
```

## Test Types

### 1. Unit Tests

**Location**: `api/__tests__/`

**Purpose**: Test individual API functions, middleware, and utilities

**Run Command**:
```bash
npm run test:api
# or
cd api && npm test
```

**Coverage**:
- API endpoints (`/`, `/health`, `/price/:id`, `/prices/:ids`)
- Rate limiting functionality
- Caching mechanisms
- Error handling
- CORS middleware

**Example**:
```javascript
describe('GET /price/:id', () => {
  it('should return cryptocurrency price for valid ID', async () => {
    // Mock external API
    nock('https://api.coingecko.com')
      .get('/api/v3/simple/price')
      .reply(200, { bitcoin: { usd: 45000.50 } });

    const response = await request(app)
      .get('/price/bitcoin')
      .expect(200);

    expect(response.body).toHaveProperty('price', 45000.50);
  });
});
```

### 2. Integration Tests

**Location**: `__tests__/integration.test.js`

**Purpose**: Test complete system interactions with real services

**Run Command**:
```bash
npm run test:integration
```

**Requirements**: Docker services must be running

**Coverage**:
- API service health and connectivity
- Real cryptocurrency price fetching
- Cross-service communication
- Database connections
- Rate limiting in practice
- Error handling with external services

**Setup**:
```bash
# Start services
docker-compose up -d

# Run tests
npm run test:integration

# Cleanup
docker-compose down
```

### 3. Performance Tests

**Location**: `__tests__/performance.test.js`

**Purpose**: Measure system performance and identify bottlenecks

**Run Command**:
```bash
npm run test:performance
```

**Metrics Tested**:
- Response times (health: <100ms, cached requests: <50ms)
- Memory usage and leak detection
- Concurrent request handling
- Cache performance improvements
- Load testing (sustained requests)
- Rate limiting performance

**Example Results**:
```
Load test results:
- Success rate: 98.5%
- Average response time: 45ms
- Max response time: 120ms
- Total requests: 150
```

### 4. End-to-End Tests

**Location**: `__tests__/e2e.test.js`

**Purpose**: Test complete user workflows with browser automation

**Run Command**:
```bash
npm run test:e2e
```

**Requirements**: 
- Full Docker environment running
- Puppeteer dependencies

**Coverage**:
- WordPress accessibility
- Plugin installation and activation
- Shortcode rendering
- Price updates and auto-refresh
- Responsive design
- Error handling in browser
- CORS functionality

**Browser Testing**:
```javascript
it('should display crypto ticker when shortcode is used', async () => {
  await page.goto(WORDPRESS_BASE_URL);
  await page.waitForSelector('.crypto-ticker');
  
  const tickerItems = await page.$$('.crypto-ticker__item');
  expect(tickerItems.length).toBeGreaterThan(0);
});
```

### 5. WordPress Plugin Tests

**Location**: `wordpress-plugin/crypto-ticker/__tests__/plugin.test.php`

**Purpose**: Test WordPress plugin functionality

**Run Command**:
```bash
# Requires WordPress test environment
phpunit wordpress-plugin/crypto-ticker/__tests__/plugin.test.php
```

**Coverage**:
- Plugin initialization
- Shortcode processing
- AJAX handlers
- Admin settings
- WordPress hooks integration
- Activation/deactivation

## Test Configuration

### Jest Configuration (`package.json`)
```json
{
  "jest": {
    "testEnvironment": "node",
    "setupFilesAfterEnv": ["<rootDir>/__tests__/setup.js"],
    "collectCoverageFrom": ["api/*.js"],
    "coverageThreshold": {
      "global": {
        "branches": 80,
        "functions": 80,
        "lines": 80,
        "statements": 80
      }
    }
  }
}
```

### Docker Test Environment

**File**: `docker-compose.test.yml`

**Services**:
- `crypto-api-test`: API service (port 3001)
- `wordpress-test`: WordPress (port 8082)
- `db-test`: MySQL database
- `test-runner`: Test execution environment

**Usage**:
```bash
# Run full Docker test suite
npm run test:docker

# Or directly
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit
```

## Test Utilities

### Mock Helpers (`__tests__/setup.js`)
```javascript
// Mock CoinGecko API response
global.testUtils.mockCompleteCoin('bitcoin', 45000, 'Bitcoin', 'BTC');

// Wait utility
await global.testUtils.wait(1000);

// Generate test data
const coinData = global.testUtils.generateRandomCoinData();
```

### Network Mocking
```javascript
// Block external calls during unit tests
nock.disableNetConnect();

// Allow localhost for integration tests
nock.enableNetConnect(/^(127\.0\.0\.1|localhost)/);
```

## Running Tests

### Command Options

**Basic Commands**:
```bash
npm test                    # Unit tests only
npm run test:api           # API unit tests
npm run test:integration   # Integration tests
npm run test:performance   # Performance tests
npm run test:e2e          # End-to-end tests
npm run test:coverage     # Tests with coverage report
```

**Test Runner Script**:
```bash
./scripts/run-tests.sh --help           # Show options
./scripts/run-tests.sh --unit           # Unit tests only
./scripts/run-tests.sh --integration    # Integration tests
./scripts/run-tests.sh --performance    # Performance tests
./scripts/run-tests.sh --e2e           # E2E tests
./scripts/run-tests.sh --all           # All test types
./scripts/run-tests.sh --coverage      # With coverage
./scripts/run-tests.sh --docker        # Docker environment
./scripts/run-tests.sh --verbose       # Verbose output
```

### Continuous Integration

**GitHub Actions Example** (`.github/workflows/test.yml`):
```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: ./scripts/run-tests.sh --all --coverage
```

## Test Data and Mocking

### External API Mocking
All external CoinGecko API calls are mocked in unit and performance tests:

```javascript
// Mock price data
nock('https://api.coingecko.com')
  .get('/api/v3/simple/price')
  .query(true)
  .reply(200, { bitcoin: { usd: 45000.50 } });
```

### Test Database
Integration tests use a separate test database:
- Database: `wordpress_test`
- User: `wordpress` / `test_password`
- Isolated from production data

### Cache Testing
Cache behavior is tested with time manipulation:
```javascript
// Test cache expiration
const cachedResponse = await request(app).get('/price/bitcoin');
// ... simulate time passage or cache clear
const freshResponse = await request(app).get('/price/bitcoin');
```

## Coverage Reports

### Generate Coverage
```bash
npm run test:coverage
```

### Coverage Thresholds
- Branches: 80%
- Functions: 80%
- Lines: 80%
- Statements: 80%

### View Coverage
```bash
# Text report in terminal
npm run test:coverage

# HTML report
open coverage/lcov-report/index.html
```

## Debugging Tests

### Verbose Output
```bash
# Enable verbose logging
VERBOSE_TESTS=true npm test

# Or with script
./scripts/run-tests.sh --verbose
```

### Debug Individual Tests
```bash
# Run specific test file
npx jest __tests__/integration.test.js

# Run specific test case
npx jest --testNamePattern="should handle rate limiting"

# Debug with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Browser Debugging (E2E)
```bash
# Run E2E tests with visible browser
HEADLESS=false npm run test:e2e
```

## Common Issues and Solutions

### Issue: Tests timeout
**Solution**: Increase timeout in test files or use `--testTimeout`
```bash
npx jest --testTimeout=60000
```

### Issue: Port conflicts
**Solution**: Check if services are already running
```bash
# Check port usage
lsof -i :3000
lsof -i :8080

# Stop existing services
docker-compose down
```

### Issue: External API failures
**Solution**: Check network mocking
```javascript
// Ensure all external calls are mocked
beforeEach(() => {
  nock.cleanAll();
  // Add your mocks here
});
```

### Issue: WordPress tests fail
**Solution**: Ensure WordPress test environment is set up
```bash
# WordPress requires specific test setup
# See: https://make.wordpress.org/core/handbook/testing/automated-testing/phpunit/
```

## Performance Benchmarks

### Expected Performance
- Health endpoint: < 100ms
- Cached price requests: < 50ms
- Fresh price requests: < 2000ms
- Bulk requests (5 coins): < 3000ms

### Load Testing Results
- Concurrent users: 20
- Success rate: > 95%
- Average response time: < 100ms
- Memory usage: Stable under load

## Contributing to Tests

### Adding New Tests
1. Choose appropriate test type and location
2. Follow existing patterns and naming
3. Include both success and failure cases
4. Mock external dependencies
5. Add performance considerations
6. Update documentation

### Test Writing Guidelines
- Use descriptive test names
- Test both happy path and edge cases
- Mock external dependencies
- Keep tests independent
- Use appropriate assertions
- Include performance checks where relevant

### Example Test Template
```javascript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should handle success case', async () => {
    // Arrange
    // Act
    // Assert
  });

  it('should handle error case', async () => {
    // Test error scenarios
  });

  it('should meet performance requirements', async () => {
    // Performance assertions
  });
});
```

For more information, see the individual test files and inline documentation.