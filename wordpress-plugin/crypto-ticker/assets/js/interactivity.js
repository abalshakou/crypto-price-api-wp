// Check if WordPress Interactivity API is available
if (typeof wp === 'undefined' || typeof wp.interactivity === 'undefined') {
    window.cryptoTickerFallback = true;
} else {
    console.log('WordPress Interactivity API is available');
}

// Import required functions only if API is available
let store, getContext;
if (!window.cryptoTickerFallback) {
    try {
        const interactivityModule = wp.interactivity;
        store = interactivityModule.store;
        getContext = interactivityModule.getContext;
    } catch (error) {
        console.error('Failed to import from WordPress Interactivity API:', error);
        window.cryptoTickerFallback = true;
    }
}

// State store for ticker
const cryptoTickerStore = !window.cryptoTickerFallback && store ? store('crypto-ticker', {
    state: {
        prices: {},
        loading: {},
        errors: {},
        lastUpdated: 'Never',
        updateInterval: null,

        // Getters for coin data
        getCoinPrice: () => {
            const context = getContext();
            const coin = context.element?.dataset?.coin;
            if (!coin) return '$0.00';

            const priceData = cryptoTickerStore.state.prices[coin];

            if (cryptoTickerStore.state.loading[coin]) return 'Loading...';
            if (cryptoTickerStore.state.errors[coin]) return 'Error';

            return priceData ? `$${parseFloat(priceData).toFixed(2)}` : '$0.00';
        },

        getCoinName: () => {
            const context = getContext();
            const coin = context.element?.dataset?.coin;
            if (!coin) return 'Unknown';

            const priceData = cryptoTickerStore.state.prices[coin];

            if (cryptoTickerStore.state.loading[coin]) return 'Loading...';
            if (cryptoTickerStore.state.errors[coin]) return 'Error';

            return priceData?.name || coin;
        },

        getCoinSymbol: () => {
            const context = getContext();
            const coin = context.element?.dataset?.coin;
            if (!coin) return 'UNK';

            const priceData = cryptoTickerStore.state.prices[coin];

            if (cryptoTickerStore.state.loading[coin]) return '...';
            if (cryptoTickerStore.state.errors[coin]) return 'ERR';

            return priceData?.symbol || coin.toUpperCase();
        },

        getItemClass: () => {
            const context = getContext();
            const coin = context.element?.dataset?.coin;
            if (!coin) return 'crypto-ticker__item';

            let classes = 'crypto-ticker__item';

            if (cryptoTickerStore.state.loading[coin]) classes += ' crypto-ticker__loading';
            if (cryptoTickerStore.state.errors[coin]) classes += ' crypto-ticker__error';

            return classes;
        }
    },

    actions: {
        // Initialize ticker
        initTicker: async () => {
            const context = getContext();
            const { coins, autoUpdate } = context;

            if (!coins || !Array.isArray(coins)) {
                console.error('Invalid coins data:', coins);
                return;
            }

            // Load initial data
            await cryptoTickerStore.actions.updatePrices(coins);

            // Start auto-update if enabled
            if (autoUpdate && !cryptoTickerStore.state.updateInterval) {
                cryptoTickerStore.state.updateInterval = setInterval(() => {
                    cryptoTickerStore.actions.updatePrices(coins);
                }, window.cryptoTicker?.update_interval || 60000);
            }
        },

        // Update prices
        updatePrices: async (coins) => {
            if (!coins || !Array.isArray(coins)) {
                console.error('Invalid coins array:', coins);
                return;
            }

            // Set loading state
            coins.forEach(coin => {
                const cleanCoin = coin.toString().trim();
                cryptoTickerStore.state.loading[cleanCoin] = true;
                cryptoTickerStore.state.errors[cleanCoin] = null;
            });

            // Load data for each coin
            const promises = coins.map(coin =>
                cryptoTickerStore.actions.fetchCoinPrice(coin.toString().trim())
            );

            try {
                await Promise.all(promises);
                cryptoTickerStore.state.lastUpdated = new Date().toLocaleTimeString();
            } catch (error) {
                console.error('Error updating prices:', error);
            }
        },

        // Fetch single coin price
        fetchCoinPrice: async (coin) => {
            try {
                // Wait for global variables availability
                await cryptoTickerStore.actions.waitForGlobals();

                // Use WordPress AJAX
                const formData = new FormData();
                formData.append('action', 'get_crypto_price');
                formData.append('coin_id', coin);
                formData.append('nonce', window.cryptoTicker.nonce);

                const response = await fetch(window.cryptoTicker.ajax_url, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    cryptoTickerStore.state.prices[coin] = result.data;
                    cryptoTickerStore.state.loading[coin] = false;
                    cryptoTickerStore.state.errors[coin] = null;
                } else {
                    throw new Error(result.data || 'Unknown error');
                }
            } catch (error) {
                console.error(`Error fetching price for ${coin}:`, error);
                cryptoTickerStore.state.loading[coin] = false;
                cryptoTickerStore.state.errors[coin] = error.message;
            }
        },

        // Wait for global variables to load
        waitForGlobals: async () => {
            const maxAttempts = 50;
            let attempts = 0;

            while (attempts < maxAttempts) {
                if (typeof window.cryptoTicker !== 'undefined' &&
                    window.cryptoTicker.nonce &&
                    window.cryptoTicker.ajax_url) {
                    return;
                }

                attempts++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            throw new Error('Global variables (cryptoTicker) are not available after waiting');
        },

        // Force update
        forceUpdate: () => {
            const context = getContext();
            const { coins } = context;
            cryptoTickerStore.actions.updatePrices(coins);
        },

        // Cleanup interval on unmount
        cleanup: () => {
            if (cryptoTickerStore.state.updateInterval) {
                clearInterval(cryptoTickerStore.state.updateInterval);
                cryptoTickerStore.state.updateInterval = null;
            }
        }
    },

    // Effects
    effects: {
        cleanup: () => {
            return () => {
                if (cryptoTickerStore.state.updateInterval) {
                    clearInterval(cryptoTickerStore.state.updateInterval);
                    cryptoTickerStore.state.updateInterval = null;
                }
            };
        }
    }
}) : null;

// Fallback for cases when Interactivity API is not available
if (window.cryptoTickerFallback) {
    document.addEventListener('DOMContentLoaded', async function() {
        const tickers = document.querySelectorAll('.crypto-ticker');

        for (const ticker of tickers) {
            const contextData = ticker.getAttribute('data-wp-context');
            let context = { coins: ['bitcoin', 'ethereum', 'cardano'], autoUpdate: true };

            if (contextData) {
                try {
                    context = JSON.parse(contextData);
                } catch (e) {
                    console.error('Failed to parse context:', e);
                }
            }

            await initTickerFallback(ticker, context);
        }
    });
}

// Fallback initialization function
async function initTickerFallback(ticker, context) {
    try {
        await waitForGlobalsFallback();
    } catch (error) {
        console.error('Failed to initialize ticker in fallback mode:', error);
        return;
    }

    const updatePrices = async () => {
        const coins = context.coins || ['bitcoin', 'ethereum', 'cardano'];

        for (const coin of coins) {
            try {
                const itemElements = ticker.querySelectorAll(`[data-wp-key="${coin}"]`);
                const priceElements = ticker.querySelectorAll(`[data-wp-key="${coin}"] .crypto-ticker__price`);

                // Set loading state
                itemElements.forEach(el => {
                    el.classList.add('crypto-ticker__loading');
                    el.classList.remove('crypto-ticker__error');
                });
                priceElements.forEach(el => el.textContent = 'Loading...');

                const formData = new FormData();
                formData.append('action', 'get_crypto_price');
                formData.append('coin_id', coin);
                formData.append('nonce', window.cryptoTicker.nonce);

                const response = await fetch(window.cryptoTicker.ajax_url, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (result.success) {
                    const data = result.data;

                    // Update elements
                    priceElements.forEach(el => {
                        el.textContent = `$${parseFloat(data.price).toFixed(2)}`;
                    });

                    ticker.querySelectorAll(`[data-wp-key="${coin}"] .crypto-ticker__name`).forEach(el => {
                        el.textContent = data.name || coin;
                    });

                    ticker.querySelectorAll(`[data-wp-key="${coin}"] .crypto-ticker__symbol`).forEach(el => {
                        el.textContent = data.symbol || coin.toUpperCase();
                    });

                    // Remove loading class
                    itemElements.forEach(el => {
                        el.classList.remove('crypto-ticker__loading');
                        el.classList.remove('crypto-ticker__error');
                    });
                } else {
                    throw new Error(result.data || 'Unknown error');
                }
            } catch (error) {
                console.error(`Error fetching price for ${coin}:`, error);

                // Add error class
                const itemElements = ticker.querySelectorAll(`[data-wp-key="${coin}"]`);
                itemElements.forEach(el => {
                    el.classList.remove('crypto-ticker__loading');
                    el.classList.add('crypto-ticker__error');
                });

                // Show error in price element
                const priceElements = ticker.querySelectorAll(`[data-wp-key="${coin}"] .crypto-ticker__price`);
                priceElements.forEach(el => el.textContent = 'Error');
            }
        }

        // Update last updated time
        const lastUpdatedElements = ticker.querySelectorAll('.crypto-ticker__last-updated');
        lastUpdatedElements.forEach(el => {
            el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        });
    };

    // Initial update
    await updatePrices();

    // Periodic updates
    if (context.autoUpdate) {
        const interval = setInterval(updatePrices, window.cryptoTicker?.update_interval || 60000);
        ticker.cryptoTickerInterval = interval;
    }
}

// Wait for global variables in fallback mode
async function waitForGlobalsFallback() {
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
        if (typeof window.cryptoTicker !== 'undefined' &&
            window.cryptoTicker.nonce &&
            window.cryptoTicker.ajax_url) {
            return;
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Global variables (cryptoTicker) are not available after waiting');
}

// Add handler for cleanup on page transitions
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('beforeunload', () => {
        if (cryptoTickerStore && cryptoTickerStore.state.updateInterval) {
            clearInterval(cryptoTickerStore.state.updateInterval);
        }

        // Clean up fallback intervals
        document.querySelectorAll('.crypto-ticker').forEach(ticker => {
            if (ticker.cryptoTickerInterval) {
                clearInterval(ticker.cryptoTickerInterval);
            }
        });
    });
});

// Export for use in other scripts
window.cryptoTickerStore = cryptoTickerStore;