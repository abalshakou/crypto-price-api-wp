#!/bin/bash

# Comprehensive test runner script for Cryptocurrency Price API project
# This script runs all types of tests in the correct order

set -e  # Exit on any error

echo "🚀 Starting Cryptocurrency Price API Test Suite"
echo "================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
print_status "Checking prerequisites..."

if ! command_exists node; then
    print_error "Node.js is not installed. Please install Node.js 14+ to run tests."
    exit 1
fi

if ! command_exists npm; then
    print_error "npm is not installed. Please install npm to run tests."
    exit 1
fi

if ! command_exists docker; then
    print_warning "Docker is not installed. Some integration tests may fail."
fi

if ! command_exists docker-compose; then
    print_warning "Docker Compose is not installed. Integration tests will be skipped."
fi

print_success "Prerequisites check completed"

# Parse command line arguments
RUN_UNIT=true
RUN_INTEGRATION=false
RUN_PERFORMANCE=false
RUN_E2E=false
RUN_COVERAGE=false
DOCKER_TESTS=false
VERBOSE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --unit)
            RUN_UNIT=true
            shift
            ;;
        --integration)
            RUN_INTEGRATION=true
            shift
            ;;
        --performance)
            RUN_PERFORMANCE=true
            shift
            ;;
        --e2e)
            RUN_E2E=true
            shift
            ;;
        --all)
            RUN_UNIT=true
            RUN_INTEGRATION=true
            RUN_PERFORMANCE=true
            RUN_E2E=true
            shift
            ;;
        --coverage)
            RUN_COVERAGE=true
            shift
            ;;
        --docker)
            DOCKER_TESTS=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            export VERBOSE_TESTS=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --unit          Run unit tests (default)"
            echo "  --integration   Run integration tests"
            echo "  --performance   Run performance tests"
            echo "  --e2e          Run end-to-end tests"
            echo "  --all          Run all test types"
            echo "  --coverage     Generate coverage report"
            echo "  --docker       Run tests in Docker environment"
            echo "  --verbose      Verbose output"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Install dependencies
print_status "Installing dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
fi

# Install API dependencies
if [ ! -d "api/node_modules" ]; then
    cd api && npm install && cd ..
fi

print_success "Dependencies installed"

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test and track results
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    print_status "Running $test_name..."
    
    if eval "$test_command"; then
        print_success "$test_name passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        print_error "$test_name failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

# Run Docker-based tests if requested
if [ "$DOCKER_TESTS" = true ]; then
    print_status "Running Docker-based integration tests..."
    
    if command_exists docker-compose; then
        # Clean up any existing test containers
        docker-compose -f docker-compose.test.yml down -v >/dev/null 2>&1 || true
        
        # Run tests in Docker
        if docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit; then
            print_success "Docker integration tests passed"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            print_error "Docker integration tests failed"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
        
        # Cleanup
        docker-compose -f docker-compose.test.yml down -v >/dev/null 2>&1 || true
    else
        print_error "Docker Compose not available for Docker tests"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
fi

# Run unit tests
if [ "$RUN_UNIT" = true ]; then
    if [ "$RUN_COVERAGE" = true ]; then
        run_test "Unit Tests (with coverage)" "npm run test:coverage"
    else
        run_test "Unit Tests" "npm run test:api"
    fi
fi

# Run integration tests
if [ "$RUN_INTEGRATION" = true ]; then
    print_status "Starting services for integration tests..."
    
    # Start services in background
    if command_exists docker-compose; then
        docker-compose up -d >/dev/null 2>&1
        sleep 10  # Wait for services to start
        
        run_test "Integration Tests" "npm run test:integration"
        
        # Stop services
        docker-compose down >/dev/null 2>&1
    else
        print_warning "Docker Compose not available. Skipping integration tests."
    fi
fi

# Run performance tests
if [ "$RUN_PERFORMANCE" = true ]; then
    run_test "Performance Tests" "npm run test:performance"
fi

# Run E2E tests
if [ "$RUN_E2E" = true ]; then
    print_status "Starting services for E2E tests..."
    
    if command_exists docker-compose; then
        docker-compose up -d >/dev/null 2>&1
        sleep 30  # Wait longer for WordPress to be ready
        
        run_test "End-to-End Tests" "npm run test:e2e"
        
        # Stop services
        docker-compose down >/dev/null 2>&1
    else
        print_warning "Docker Compose not available. Skipping E2E tests."
    fi
fi

# Print summary
echo ""
echo "================================================="
echo "🏁 Test Suite Summary"
echo "================================================="

if [ $TESTS_PASSED -gt 0 ]; then
    print_success "Tests passed: $TESTS_PASSED"
fi

if [ $TESTS_FAILED -gt 0 ]; then
    print_error "Tests failed: $TESTS_FAILED"
fi

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$(( (TESTS_PASSED * 100) / TOTAL_TESTS ))
    echo "Success rate: ${SUCCESS_RATE}%"
fi

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    print_success "All tests completed successfully! 🎉"
    exit 0
else
    print_error "Some tests failed. Please check the output above."
    exit 1
fi