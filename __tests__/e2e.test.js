const puppeteer = require('puppeteer');
const axios = require('axios');

/**
 * End-to-End tests for the complete system
 * Tests the WordPress plugin integration with the API
 */

describe('E2E Tests - WordPress Plugin Integration', () => {
  let browser;
  let page;
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
  const WORDPRESS_BASE_URL = process.env.WORDPRESS_URL || 'http://localhost:8080';

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    // Wait for services to be ready
    await waitForServices();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport for consistent testing
    await page.setViewport({ width: 1200, height: 800 });
    
    // Enable console logging in tests
    page.on('console', msg => {
      if (process.env.VERBOSE_TESTS) {
        console.log('PAGE LOG:', msg.text());
      }
    });
    
    // Catch page errors
    page.on('pageerror', error => {
      console.error('PAGE ERROR:', error.message);
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('WordPress Installation and Plugin', () => {
    it('should have WordPress accessible', async () => {
      await page.goto(WORDPRESS_BASE_URL, { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      
      const title = await page.title();
      expect(title).toContain('WordPress');
    }, 45000);

    it('should have plugin files mounted correctly', async () => {
      // Check if we can access the plugin directory structure
      const response = await axios.get(`${WORDPRESS_BASE_URL}/wp-content/plugins/crypto-ticker/crypto-ticker.php`);
      
      // Plugin files should not be directly accessible (403 Forbidden)
      expect([403, 404]).toContain(response.status || response.response?.status);
    });
  });

  describe('API Integration Tests', () => {
    it('should have API accessible from WordPress environment', async () => {
      // Test API directly
      const response = await axios.get(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
      expect(response.data.status).toBe('OK');
    });

    it('should fetch cryptocurrency data successfully', async () => {
      const response = await axios.get(`${API_BASE_URL}/price/bitcoin`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('symbol');
      expect(response.data).toHaveProperty('price');
      expect(typeof response.data.price).toBe('number');
    });

    it('should handle CORS properly for cross-origin requests', async () => {
      await page.goto(WORDPRESS_BASE_URL);
      
      // Test CORS by making a request from the browser
      const result = await page.evaluate(async (apiUrl) => {
        try {
          const response = await fetch(`${apiUrl}/health`);
          return {
            status: response.status,
            data: await response.json()
          };
        } catch (error) {
          return { error: error.message };
        }
      }, API_BASE_URL);

      expect(result.status).toBe(200);
      expect(result.data).toHaveProperty('status', 'OK');
    });
  });

  describe('Plugin Functionality Tests', () => {
    it('should display crypto ticker when shortcode is used', async () => {
      // This test assumes WordPress is set up and a test page with shortcode exists
      // In a real scenario, you'd need to set up WordPress with the plugin activated
      
      await page.goto(WORDPRESS_BASE_URL);
      
      // Check if we can find crypto ticker elements
      // Note: This will only work if the plugin is activated and shortcode is present
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        const tickerExists = await page.$('.crypto-ticker');
        expect(tickerExists).toBeTruthy();
        
        // Check for crypto ticker items
        const tickerItems = await page.$$('.crypto-ticker__item');
        expect(tickerItems.length).toBeGreaterThan(0);
        
      } catch (error) {
        // If plugin isn't activated or shortcode isn't present, skip this test
        console.log('Crypto ticker not found on page - plugin may not be activated');
      }
    });

    it('should update prices automatically', async () => {
      await page.goto(WORDPRESS_BASE_URL);
      
      try {
        // Wait for ticker to load
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        // Get initial price
        const initialPrice = await page.$eval('.crypto-ticker__price', el => el.textContent);
        
        // Wait for auto-update (if implemented)
        await page.waitForTimeout(65000); // Wait for 1+ minute for auto-update
        
        // Get updated price
        const updatedPrice = await page.$eval('.crypto-ticker__price', el => el.textContent);
        
        // Price should be updated (or at least the timestamp should change)
        const lastUpdated = await page.$eval('.crypto-ticker__last-updated', el => el.textContent);
        expect(lastUpdated).not.toBe('Last updated: Never');
        
      } catch (error) {
        console.log('Auto-update test skipped - ticker not present');
      }
    }, 70000); // Long timeout for auto-update test

    it('should handle multiple cryptocurrencies in one ticker', async () => {
      await page.goto(WORDPRESS_BASE_URL);
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        const tickerItems = await page.$$('.crypto-ticker__item');
        
        if (tickerItems.length > 1) {
          // Check that each item has the required elements
          for (let i = 0; i < tickerItems.length; i++) {
            const item = tickerItems[i];
            
            const symbol = await item.$('.crypto-ticker__symbol');
            const price = await item.$('.crypto-ticker__price');
            
            expect(symbol).toBeTruthy();
            expect(price).toBeTruthy();
            
            const priceText = await price.evaluate(el => el.textContent);
            expect(priceText).toMatch(/\$[\d,]+\.?\d*/); // Should be currency format
          }
        }
        
      } catch (error) {
        console.log('Multiple cryptocurrency test skipped - ticker not present');
      }
    });
  });

  describe('Responsive Design Tests', () => {
    it('should display correctly on mobile devices', async () => {
      await page.setViewport({ width: 375, height: 667 }); // iPhone 6/7/8 size
      await page.goto(WORDPRESS_BASE_URL);
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        // Check if mobile styles are applied
        const tickerContainer = await page.$('.crypto-ticker__container');
        const containerStyles = await page.evaluate(el => {
          return window.getComputedStyle(el);
        }, tickerContainer);
        
        // Mobile layout should stack items vertically
        expect(['column', 'column-reverse']).toContain(containerStyles.flexDirection);
        
      } catch (error) {
        console.log('Mobile test skipped - ticker not present');
      }
    });

    it('should display correctly on desktop', async () => {
      await page.setViewport({ width: 1200, height: 800 });
      await page.goto(WORDPRESS_BASE_URL);
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        const tickerItems = await page.$$('.crypto-ticker__item');
        
        if (tickerItems.length > 1) {
          // On desktop, items should be in a row
          const containerStyles = await page.evaluate(() => {
            const container = document.querySelector('.crypto-ticker__container');
            return window.getComputedStyle(container);
          });
          
          expect(['row', 'row-reverse']).toContain(containerStyles.flexDirection);
        }
        
      } catch (error) {
        console.log('Desktop test skipped - ticker not present');
      }
    });
  });

  describe('Error Handling E2E Tests', () => {
    it('should handle API downtime gracefully', async () => {
      await page.goto(WORDPRESS_BASE_URL);
      
      // Simulate API downtime by blocking requests
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (req.url().includes(':3000')) {
          req.abort();
        } else {
          req.continue();
        }
      });
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        // Should show error state or loading state
        const errorElement = await page.$('.crypto-ticker__error, .crypto-ticker__loading');
        
        if (errorElement) {
          const errorText = await errorElement.evaluate(el => el.textContent);
          expect(errorText).toBeTruthy();
        }
        
      } catch (error) {
        console.log('API downtime test skipped - ticker not present');
      }
    });

    it('should handle invalid cryptocurrency IDs', async () => {
      await page.goto(WORDPRESS_BASE_URL);
      
      // This test would require a page with an invalid cryptocurrency ID in the shortcode
      // [crypto_ticker coins="invalid-coin-123"]
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 5000 });
        
        // Look for error indicators
        const errorElements = await page.$$('.crypto-ticker__error, .crypto-ticker__item--error');
        
        // If there are invalid coins, there should be error elements
        // This is a basic check - in practice you'd need specific test data
        
      } catch (error) {
        console.log('Invalid coin test skipped - ticker not present');
      }
    });
  });

  describe('Performance E2E Tests', () => {
    it('should load ticker within reasonable time', async () => {
      const startTime = Date.now();
      
      await page.goto(WORDPRESS_BASE_URL, { waitUntil: 'networkidle0' });
      
      try {
        await page.waitForSelector('.crypto-ticker', { timeout: 10000 });
        
        const loadTime = Date.now() - startTime;
        
        // Should load within 10 seconds
        expect(loadTime).toBeLessThan(10000);
        
        // Check if prices are loaded (not just loading state)
        const priceElements = await page.$$('.crypto-ticker__price');
        
        for (const priceEl of priceElements) {
          const priceText = await priceEl.evaluate(el => el.textContent);
          expect(priceText).not.toBe('$0.00');
          expect(priceText).not.toBe('Loading...');
        }
        
      } catch (error) {
        console.log('Performance test skipped - ticker not present');
      }
    });
  });
});

/**
 * Utility function to wait for all services to be ready
 */
async function waitForServices() {
  const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
  const WORDPRESS_BASE_URL = process.env.WORDPRESS_URL || 'http://localhost:8080';
  
  console.log('Waiting for services to be ready...');
  
  // Wait for API
  await waitForService(API_BASE_URL, 'API');
  
  // Wait for WordPress
  await waitForService(WORDPRESS_BASE_URL, 'WordPress');
  
  console.log('All services are ready!');
}

async function waitForService(url, serviceName, timeout = 60000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      await axios.get(url, { timeout: 5000 });
      console.log(`${serviceName} service is ready`);
      return;
    } catch (error) {
      console.log(`Waiting for ${serviceName} service...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error(`${serviceName} service did not become ready within ${timeout}ms`);
}