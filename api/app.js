const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Enhanced cache with longer duration
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

// Rate limiting
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 50; // Conservative limit

// Middleware for JSON
app.use(express.json());

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Rate limiting check
function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;

    if (!rateLimiter.has(ip)) {
        rateLimiter.set(ip, []);
    }

    const requests = rateLimiter.get(ip);
    // Remove old requests
    const recentRequests = requests.filter(time => time > windowStart);

    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
        return false;
    }

    recentRequests.push(now);
    rateLimiter.set(ip, recentRequests);
    return true;
}

// Function to get cryptocurrency data
async function getCryptocurrencyData(id) {
    try {
        // First try to get basic price data
        const priceResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: id,
                vs_currencies: 'usd',
                include_market_cap: false,
                include_24hr_vol: false,
                include_24hr_change: false,
                include_last_updated_at: false
            },
            timeout: 10000 // 10 second timeout
        });

        if (!priceResponse.data[id]) {
            throw new Error('Cryptocurrency not found');
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

        // Get additional information (name and symbol)
        const infoResponse = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
            params: {
                localization: false,
                tickers: false,
                market_data: false,
                community_data: false,
                developer_data: false,
                sparkline: false
            },
            timeout: 10000
        });

        return {
            name: infoResponse.data.name,
            symbol: infoResponse.data.symbol.toUpperCase(),
            price: priceResponse.data[id].usd
        };
    } catch (error) {
        console.error(`Error fetching data for ${id}:`, error.message);

        if (error.response) {
            if (error.response.status === 404) {
                throw new Error('Cryptocurrency not found');
            } else if (error.response.status === 429) {
                throw new Error('Rate limit exceeded. Please try again later.');
            }
        }

        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout');
        }

        throw error;
    }
}

// Function to get multiple cryptocurrencies at once
async function getMultipleCryptocurrencyData(ids) {
    try {
        const idsString = ids.join(',');

        // Get price data for all coins at once
        const priceResponse = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: idsString,
                vs_currencies: 'usd',
                include_market_cap: false,
                include_24hr_vol: false,
                include_24hr_change: false,
                include_last_updated_at: false
            },
            timeout: 15000
        });

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));

        // Get coin info for all coins
        const infoPromises = ids.map(async (id) => {
            try {
                const response = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
                    params: {
                        localization: false,
                        tickers: false,
                        market_data: false,
                        community_data: false,
                        developer_data: false,
                        sparkline: false
                    },
                    timeout: 10000
                });
                return {
                    id,
                    name: response.data.name,
                    symbol: response.data.symbol.toUpperCase()
                };
            } catch (error) {
                console.error(`Error fetching info for ${id}:`, error.message);
                return {
                    id,
                    name: id,
                    symbol: id.toUpperCase()
                };
            }
        });

        const infoResults = await Promise.all(infoPromises);

        // Combine price and info data
        const result = {};
        infoResults.forEach(info => {
            if (priceResponse.data[info.id]) {
                result[info.id] = {
                    name: info.name,
                    symbol: info.symbol,
                    price: priceResponse.data[info.id].usd
                };
            }
        });

        return result;
    } catch (error) {
        console.error('Error fetching multiple cryptocurrency data:', error.message);
        throw error;
    }
}

// Function to check cache
function getCachedData(id) {
    const cached = cache.get(id);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    return null;
}

// Function to save to cache
function setCachedData(id, data) {
    cache.set(id, {
        data,
        timestamp: Date.now()
    });
}

// Endpoint to get cryptocurrency price
app.get('/price/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check rate limit
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.'
            });
        }

        // Check cache
        const cachedData = getCachedData(id);
        if (cachedData) {
            console.log(`Cache hit for ${id}`);
            return res.json(cachedData);
        }

        console.log(`Cache miss for ${id}, fetching from API`);

        // Get data from API
        const data = await getCryptocurrencyData(id);

        // Save to cache
        setCachedData(id, data);

        res.json(data);
    } catch (error) {
        console.error('Error fetching cryptocurrency data:', error.message);

        if (error.message === 'Cryptocurrency not found') {
            return res.status(404).json({
                error: 'Cryptocurrency not found',
                message: 'The specified cryptocurrency ID does not exist'
            });
        }

        if (error.message === 'Rate limit exceeded. Please try again later.') {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'API rate limit exceeded. Please try again later.'
            });
        }

        if (error.message === 'Request timeout') {
            return res.status(408).json({
                error: 'Request timeout',
                message: 'Request took too long to complete'
            });
        }

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch cryptocurrency data'
        });
    }
});

// New endpoint to get multiple cryptocurrencies at once
app.get('/prices/:ids', async (req, res) => {
    try {
        const { ids } = req.params;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Check rate limit
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests. Please try again later.'
            });
        }

        const coinIds = ids.split(',').map(id => id.trim());

        // Check cache for all coins
        const cachedResults = {};
        const missingIds = [];

        coinIds.forEach(id => {
            const cached = getCachedData(id);
            if (cached) {
                cachedResults[id] = cached;
            } else {
                missingIds.push(id);
            }
        });

        let freshResults = {};
        if (missingIds.length > 0) {
            console.log(`Fetching missing data for: ${missingIds.join(', ')}`);
            freshResults = await getMultipleCryptocurrencyData(missingIds);

            // Cache the fresh results
            Object.entries(freshResults).forEach(([id, data]) => {
                setCachedData(id, data);
            });
        }

        // Combine cached and fresh results
        const allResults = { ...cachedResults, ...freshResults };

        res.json(allResults);
    } catch (error) {
        console.error('Error fetching multiple cryptocurrency data:', error.message);

        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch cryptocurrency data'
        });
    }
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'Cryptocurrency Price API',
        usage: {
            single: 'GET /price/{id} - Get cryptocurrency price by ID',
            multiple: 'GET /prices/{ids} - Get multiple cryptocurrency prices (comma-separated)'
        },
        examples: [
            '/price/bitcoin',
            '/price/ethereum',
            '/price/cardano',
            '/prices/bitcoin,ethereum,cardano'
        ]
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        cache_size: cache.size,
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

app.listen(PORT, () => {
    console.log(`Cryptocurrency Price API running on port ${PORT}`);
    console.log(`Visit http://localhost:${PORT} for usage information`);
});

module.exports = app;