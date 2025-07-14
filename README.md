# Cryptocurrency Price API

Professional cryptocurrency price API service with WordPress plugin integration, built with Node.js and Express with advanced caching and rate limiting.

## Features

- **Single Price**: `/price/{id}` - get cryptocurrency price by ID
- **Bulk Prices**: `/prices/{ids}` - get multiple cryptocurrency prices at once
- **Advanced Caching**: 5-minute cache with intelligent cache management
- **Rate Limiting**: 50 requests per minute per IP address
- **CORS Support**: Cross-origin requests enabled
- **Error Handling**: Comprehensive error handling with proper HTTP status codes
- **WordPress Integration**: Ready-to-use WordPress plugin with full containerization
- **Full Stack Deployment**: Complete Docker environment with WordPress, MySQL, and phpMyAdmin
- **Data Source**: CoinGecko API (free tier)

## Quick Start

### Option 1: Full Stack Deployment (recommended)

Deploy complete environment with API, WordPress, MySQL, and phpMyAdmin:

```bash
# Build and run all services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

**Services will be available at:**
- **API**: http://localhost:3000
- **WordPress**: http://localhost:8080
- **phpMyAdmin**: http://localhost:8081

### Option 2: API only (local development)

```bash
# Navigate to API directory
cd api

# Install dependencies
npm install

# Run in development mode
npm run dev

# Or normal start
npm start
```

### Option 3: WordPress Plugin Installation (existing WordPress)

1. Copy the `wordpress-plugin/crypto-ticker/` directory to your WordPress `wp-content/plugins/` directory
2. Activate the plugin in WordPress admin panel
3. Configure the API endpoint in plugin settings

## Docker Services

The project includes a complete containerized environment:

### Service Overview

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| **crypto-api** | crypto-api | 3000 | Cryptocurrency price API |
| **wordpress** | wordpress | 8080 | WordPress CMS |
| **db** | mysql_db | 3306 | MySQL database |
| **phpmyadmin** | phpmyadmin | 8081 | Database management |

### Container Configuration

#### API Service (crypto-api)
- **Image**: Custom build from `./api`
- **Port**: 3000
- **Environment**: Production mode with health checks
- **Health Check**: Automated health monitoring every 30 seconds
- **Restart Policy**: Always restart unless manually stopped

#### WordPress Service
- **Image**: Official WordPress latest
- **Port**: 8080
- **Database**: Connected to MySQL container
- **Plugin**: Crypto Ticker plugin automatically mounted
- **Debug Mode**: Enabled for development

#### Database Service (MySQL)
- **Image**: MySQL 8.0
- **Internal Port**: 3306
- **Authentication**: Native password plugin
- **Persistence**: Data stored in Docker volume
- **Credentials**:
    - Root password: `root_password`
    - WordPress user: `wordpress`
    - WordPress password: `wordpress_password`

#### phpMyAdmin Service
- **Image**: Official phpMyAdmin latest
- **Port**: 8081
- **Purpose**: Database management interface
- **Access**: Root credentials for full database access

## API Usage

### Get single cryptocurrency price

```bash
GET /price/{id}
```

**Example requests:**

```bash
# Bitcoin (using Docker service)
curl http://localhost:3000/price/bitcoin

# Ethereum
curl http://localhost:3000/price/ethereum

# Cardano
curl http://localhost:3000/price/cardano
```

**Example response:**

```json
{
  "name": "Bitcoin",
  "symbol": "BTC",
  "price": 45000.50
}
```

### Get multiple cryptocurrency prices

```bash
GET /prices/{comma-separated-ids}
```

**Example requests:**

```bash
# Multiple cryptocurrencies
curl http://localhost:3000/prices/bitcoin,ethereum,cardano

# Two cryptocurrencies
curl http://localhost:3000/prices/bitcoin,ethereum
```

**Example response:**

```json
{
  "bitcoin": {
    "name": "Bitcoin",
    "symbol": "BTC",
    "price": 45000.50
  },
  "ethereum": {
    "name": "Ethereum",
    "symbol": "ETH",
    "price": 2800.25
  },
  "cardano": {
    "name": "Cardano",
    "symbol": "ADA",
    "price": 0.45
  }
}
```

### Additional endpoints

```bash
# API information and usage examples
curl http://localhost:3000/

# Health check with system status
curl http://localhost:3000/health
```

## Supported Cryptocurrencies

The API supports all cryptocurrencies available in CoinGecko. Use the cryptocurrency ID from CoinGecko:

- `bitcoin` - Bitcoin
- `ethereum` - Ethereum
- `cardano` - Cardano
- `polkadot` - Polkadot
- `chainlink` - Chainlink
- `litecoin` - Litecoin
- `stellar` - Stellar
- `dogecoin` - Dogecoin
- `ripple` - XRP
- And 10,000+ more...

Full list of IDs can be found at [CoinGecko API](https://api.coingecko.com/api/v3/coins/list).

## Performance Features

### Caching System
- **Duration**: 5 minutes per cryptocurrency
- **Type**: In-memory caching with timestamp validation
- **Efficiency**: Separate cache entries for each coin
- **Cache hits**: Logged for monitoring

### Rate Limiting
- **Limit**: 50 requests per minute per IP address
- **Window**: 1-minute sliding window
- **Protection**: Prevents API abuse and external rate limiting
- **Response**: HTTP 429 when limit exceeded

### Health Monitoring
- **Docker Health Check**: Automated health monitoring every 30 seconds
- **Endpoint**: `/health` provides system status information
- **Timeout**: 10-second timeout with 3 retries
- **Start Period**: 40-second grace period for container startup

### API Optimization
- **Timeouts**: 10-15 second request timeouts
- **Delays**: Built-in delays to respect CoinGecko rate limits
- **Bulk Requests**: Efficient batch processing for multiple coins
- **Error Recovery**: Graceful handling of API failures

## Error Handling

The API provides comprehensive error handling with appropriate HTTP status codes:

- **404 Not Found**: Cryptocurrency ID doesn't exist
- **408 Request Timeout**: Request took too long to complete
- **429 Too Many Requests**: Rate limit exceeded (client or API)
- **500 Internal Server Error**: Unexpected server error

**Error response format:**

```json
{
  "error": "Error type",
  "message": "Detailed error description"
}
```

## WordPress Integration

### Docker Setup

The WordPress service is pre-configured with:
- **Plugin Integration**: Crypto Ticker plugin automatically available
- **API Connection**: Pre-configured to connect to crypto-api service
- **Database**: Connected to MySQL container
- **Debug Mode**: Enabled for development

### WordPress Access

1. **Open WordPress**: http://localhost:8080
2. **Complete Setup**: Follow WordPress installation wizard
3. **Database Configuration**: (Pre-configured in Docker)
    - Database Name: `wordpress`
    - Username: `wordpress`
    - Password: `wordpress_password`
    - Database Host: `db:3306`

### Plugin Activation

1. **Access Admin**: http://localhost:8080/wp-admin
2. **Navigate to Plugins**: Plugins → Installed Plugins
3. **Activate**: Find "Crypto Ticker" and click "Activate"
4. **Configure**: Settings → Crypto Ticker
5. **Set API Endpoint**: `http://crypto-api:3000` (internal Docker network)

### Plugin Features

- **Real-time Prices**: Display cryptocurrency prices on any page/post
- **WordPress Interactivity API**: Uses modern WordPress 6.5+ Interactivity API with fallback
- **Shortcode Support**: Use `[crypto_ticker]` shortcode with customizable parameters
- **Admin Settings**: Configure display locations and default coins
- **Auto-display**: Automatically show ticker on homepage and posts (configurable)
- **Responsive Design**: Mobile-friendly with hover effects and animations
- **Auto-refresh**: Prices update automatically every minute
- **Docker Optimized**: Pre-configured for containerized environment

## Project Structure

```
crypto-price-api/
├── .env                    # Environment variables
├── .gitignore             # Git exclusions
├── README.md              # Project documentation
├── docker-compose.yml     # Full stack Docker Compose setup
├── api/                   # API service directory
│   ├── .dockerignore      # Docker exclusions for API
│   ├── Dockerfile         # API container configuration
│   ├── app.js             # Main API application file
│   ├── docker-compose.yml # API-specific Docker Compose
│   ├── package.json       # API dependencies and scripts
│   └── package-lock.json  # API dependency lock file
└── wordpress-plugin/      # WordPress integration
    └── crypto-ticker/     # WordPress plugin
        ├── crypto-ticker.php           # Main plugin file
        └── assets/js/interactivity.js  # Frontend JavaScript
```

## Development

### Full Stack Development

```bash
# Start all services
docker-compose up --build

# View logs for specific service
docker-compose logs -f crypto-api
docker-compose logs -f wordpress
docker-compose logs -f db

# Execute commands in running containers
docker-compose exec crypto-api npm run dev
docker-compose exec wordpress wp-cli core version
docker-compose exec db mysql -u wordpress -p wordpress

# Restart specific service
docker-compose restart crypto-api
```

### API Development

```bash
# Run API in development mode (outside Docker)
cd api && npm run dev

# Or develop within Docker container
docker-compose exec crypto-api npm run dev

# Check health and system status
curl http://localhost:3000/health

# Test API endpoints
curl http://localhost:3000/price/bitcoin
curl http://localhost:3000/prices/bitcoin,ethereum,cardano
```

### WordPress Plugin Development

1. **Plugin location**: `wordpress-plugin/crypto-ticker/` (auto-mounted in Docker)
2. **Edit files**: Changes reflect immediately in running container
3. **WordPress admin**: http://localhost:8080/wp-admin
4. **Debug mode**: Enabled by default in Docker environment
5. **Plugin settings**: Settings → Crypto Ticker
6. **API endpoint**: Use `http://crypto-api:3000` for Docker network communication

### Database Management

Access phpMyAdmin at http://localhost:8081:
- **Server**: db
- **Username**: root
- **Password**: root_password

Or connect directly:
```bash
# Access MySQL container
docker-compose exec db mysql -u root -p

# View WordPress tables
docker-compose exec db mysql -u wordpress -p wordpress
```

## Deployment

### Production Deployment

```bash
# Deploy full stack
docker-compose up -d --build

# Check service status
docker-compose ps

# Monitor logs
docker-compose logs -f

# Update services
docker-compose pull
docker-compose up -d --build
```

### Environment Variables

Create `.env` file for production:

```env
# API Configuration
NODE_ENV=production
PORT=3000

# Database Configuration
MYSQL_ROOT_PASSWORD=your_secure_root_password
MYSQL_DATABASE=wordpress
MYSQL_USER=wordpress
MYSQL_PASSWORD=your_secure_wordpress_password

# WordPress Configuration
WORDPRESS_DB_HOST=db:3306
WORDPRESS_DB_USER=wordpress
WORDPRESS_DB_PASSWORD=your_secure_wordpress_password
WORDPRESS_DB_NAME=wordpress
WORDPRESS_DEBUG=0
```

### SSL/HTTPS Setup

For production with SSL:

```yaml
# Add to docker-compose.yml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - wordpress
      - crypto-api
```

## Service Management

### Start Services

```bash
# Start all services
docker-compose up -d

# Start specific service
docker-compose up -d crypto-api

# Build and start
docker-compose up -d --build
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Stop and remove images
docker-compose down --rmi all

# Complete cleanup
docker-compose down -v --rmi all --remove-orphans
```

### Monitor Services

```bash
# View running services
docker-compose ps

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f crypto-api

# Check resource usage
docker stats
```

### Troubleshooting

#### Common Issues

1. **Port conflicts**: Change ports in docker-compose.yml
2. **Database connection**: Ensure db service is running
3. **Plugin not visible**: Check volume mounting
4. **API unreachable**: Verify crypto-api service health

#### Debug Commands

```bash
# Check service health
docker-compose exec crypto-api curl http://localhost:3000/health

# Test database connection
docker-compose exec wordpress wp db check

# View WordPress logs
docker-compose exec wordpress tail -f /var/log/apache2/error.log

# Check network connectivity
docker-compose exec wordpress ping crypto-api
```

## API Limits

- **CoinGecko Free Tier**: 50 requests per minute
- **Internal Rate Limit**: 50 requests per minute per IP
- **Cache Duration**: 5 minutes
- **Request Timeout**: 10-15 seconds
- **Bulk Request**: No limit on number of cryptocurrencies per request
- **Health Check**: 30-second intervals with 10-second timeout

## Security Considerations

 
