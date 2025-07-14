<?php
/**
 * Plugin Name: Cryptocurrency Price Ticker
 * Description: Displays real-time cryptocurrency prices using WordPress Interactivity API
 * Version: 1.0.0
 * Author: Artsiom Balshakou
 * License: GPL v2 or later
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Define constants
define('CRYPTO_TICKER_VERSION', '1.0.0');
define('CRYPTO_TICKER_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CRYPTO_TICKER_PLUGIN_PATH', plugin_dir_path(__FILE__));

class CryptocurrencyTicker {

    private $api_url = 'http://crypto-api:3000';

    public function __construct() {
        add_action('init', array($this, 'init'));
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_head', array($this, 'add_inline_styles'));
        add_shortcode('crypto_ticker', array($this, 'render_shortcode'));
        add_action('wp_ajax_get_crypto_price', array($this, 'ajax_get_crypto_price'));
        add_action('wp_ajax_nopriv_get_crypto_price', array($this, 'ajax_get_crypto_price'));
        add_action('wp_footer', array($this, 'display_ticker'));
        add_action('admin_menu', array($this, 'add_admin_menu'));
    }

    public function init() {
        // Register Gutenberg block
        if (function_exists('register_block_type')) {
            // register_block_type(__DIR__ . '/build');
        }
    }

    public function enqueue_scripts() {
        $wp_version = get_bloginfo('version');
        $has_interactivity = version_compare($wp_version, '6.5', '>=');

        if ($has_interactivity && function_exists('wp_register_script_module')) {
            // Register script module with Interactivity API dependency
            wp_register_script_module(
                'crypto-ticker-interactivity',
                CRYPTO_TICKER_PLUGIN_URL . 'assets/js/interactivity.js',
                array('@wordpress/interactivity'),
                CRYPTO_TICKER_VERSION
            );

            wp_enqueue_script_module('crypto-ticker-interactivity');
        } else {
            // Fallback for older WordPress versions
            wp_enqueue_script(
                'crypto-ticker-interactivity',
                CRYPTO_TICKER_PLUGIN_URL . 'assets/js/interactivity-fallback.js',
                array('jquery'),
                CRYPTO_TICKER_VERSION,
                true
            );
        }

        // Pass data to JavaScript
        $script_data = array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('crypto_ticker_nonce'),
            'update_interval' => 60000, // 1 minute
            'api_url' => $this->api_url,
            'plugin_url' => CRYPTO_TICKER_PLUGIN_URL,
            'wp_version' => $wp_version,
            'has_interactivity' => $has_interactivity
        );

        // Add data as global variable
        add_action('wp_head', function() use ($script_data) {
            echo '<script>window.cryptoTicker = ' . wp_json_encode($script_data) . ';</script>';
        });

        // Enqueue styles
        wp_enqueue_style(
            'crypto-ticker-styles',
            CRYPTO_TICKER_PLUGIN_URL . 'assets/css/styles.css',
            array(),
            CRYPTO_TICKER_VERSION
        );
    }

    public function add_inline_styles() {
        ?>
        <style>
            .crypto-ticker {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px;
                border-radius: 10px;
                margin: 20px 0;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            }

            .crypto-ticker__container {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 20px;
            }

            .crypto-ticker__item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 15px;
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
            }

            .crypto-ticker__item:hover {
                transform: translateY(-2px);
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
            }

            .crypto-ticker__symbol {
                font-weight: bold;
                font-size: 1.1em;
                color: #FFD700;
            }

            .crypto-ticker__name {
                font-size: 0.9em;
                opacity: 0.9;
            }

            .crypto-ticker__price {
                font-size: 1.2em;
                font-weight: bold;
                color: #00FF88;
            }

            .crypto-ticker__loading {
                color: #FFA500;
                font-style: italic;
            }

            .crypto-ticker__error {
                color: #FF6B6B;
                background: rgba(255,107,107,0.1);
                padding: 10px;
                border-radius: 5px;
                border-left: 4px solid #FF6B6B;
            }

            .crypto-ticker__last-updated {
                font-size: 0.8em;
                opacity: 0.7;
                text-align: center;
                margin-top: 10px;
            }

            @media (max-width: 768px) {
                .crypto-ticker__container {
                    flex-direction: column;
                }

                .crypto-ticker__item {
                    width: 100%;
                    justify-content: space-between;
                }
            }
        </style>
        <?php
    }

    public function render_shortcode($atts) {
        $atts = shortcode_atts(array(
            'coins' => 'bitcoin,ethereum,cardano',
            'show_name' => 'true',
            'show_symbol' => 'true',
            'auto_update' => 'true'
        ), $atts);

        $coins = explode(',', $atts['coins']);
        $show_name = $atts['show_name'] === 'true';
        $show_symbol = $atts['show_symbol'] === 'true';
        $auto_update = $atts['auto_update'] === 'true';

        // Ensure scripts are loaded
        if (function_exists('wp_enqueue_script_module')) {
            wp_enqueue_script_module('crypto-ticker-interactivity');
        } else {
            wp_enqueue_script('crypto-ticker-interactivity');
        }

        ob_start();
        ?>
        <div class="crypto-ticker"
             data-wp-interactive="crypto-ticker"
             data-wp-init="actions.initTicker"
             data-wp-context='{"coins": <?php echo json_encode($coins); ?>, "autoUpdate": <?php echo json_encode($auto_update); ?>}'>

            <div class="crypto-ticker__container">
                <?php foreach ($coins as $coin): ?>
                    <div class="crypto-ticker__item"
                         data-wp-key="<?php echo esc_attr(trim($coin)); ?>"
                         data-wp-bind--class="state.getItemClass">

                        <?php if ($show_symbol): ?>
                            <span class="crypto-ticker__symbol"
                                  data-wp-text="state.getCoinSymbol"
                                  data-wp-bind--data-coin="<?php echo esc_attr(trim($coin)); ?>">
                                <?php echo strtoupper(trim($coin)); ?>
                            </span>
                        <?php endif; ?>

                        <?php if ($show_name): ?>
                            <span class="crypto-ticker__name"
                                  data-wp-text="state.getCoinName"
                                  data-wp-bind--data-coin="<?php echo esc_attr(trim($coin)); ?>">
                                Loading...
                            </span>
                        <?php endif; ?>

                        <span class="crypto-ticker__price"
                              data-wp-text="state.getCoinPrice"
                              data-wp-bind--data-coin="<?php echo esc_attr(trim($coin)); ?>">
                            $0.00
                        </span>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="crypto-ticker__last-updated"
                 data-wp-text="state.lastUpdated">
                Last updated: Never
            </div>
        </div>
        <?php
        return ob_get_clean();
    }

    public function ajax_get_crypto_price() {
        // Verify nonce
        if (!wp_verify_nonce($_POST['nonce'], 'crypto_ticker_nonce')) {
            wp_die('Security check failed');
        }

        $coin_id = sanitize_text_field($_POST['coin_id']);

        if (empty($coin_id)) {
            wp_send_json_error('Coin ID is required');
        }

        // Get data from API
        $response = wp_remote_get($this->api_url . '/price/' . $coin_id, array(
            'timeout' => 10,
            'headers' => array(
                'Accept' => 'application/json',
            ),
        ));

        if (is_wp_error($response)) {
            wp_send_json_error('Failed to connect to API: ' . $response->get_error_message());
        }

        $status_code = wp_remote_retrieve_response_code($response);
        $body = wp_remote_retrieve_body($response);

        if ($status_code !== 200) {
            $error_data = json_decode($body, true);
            $error_message = isset($error_data['message']) ? $error_data['message'] : 'Unknown API error';
            wp_send_json_error($error_message);
        }

        $data = json_decode($body, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            wp_send_json_error('Invalid JSON response');
        }

        // Check data structure
        if (!isset($data['price'])) {
            wp_send_json_error('Invalid data structure');
        }

        // Format standardized response
        $response_data = array(
            'price' => $data['price'],
            'name' => isset($data['name']) ? $data['name'] : ucfirst($coin_id),
            'symbol' => isset($data['symbol']) ? $data['symbol'] : strtoupper($coin_id),
            'coin_id' => $coin_id,
            'timestamp' => time()
        );

        wp_send_json_success($response_data);
    }

    public function display_ticker() {
        // Check ticker display settings
        $show_on_homepage = get_option('crypto_ticker_show_homepage', true);
        $show_on_posts = get_option('crypto_ticker_show_posts', true);
        $default_coins = get_option('crypto_ticker_default_coins', 'bitcoin,ethereum,cardano');

        $should_show = false;

        if ($show_on_homepage && is_home()) {
            $should_show = true;
        } elseif ($show_on_posts && is_single()) {
            $should_show = true;
        }

        if ($should_show) {
            echo $this->render_shortcode(array('coins' => $default_coins));
        }
    }

    public function add_admin_menu() {
        add_options_page(
            'Crypto Ticker Settings',
            'Crypto Ticker',
            'manage_options',
            'crypto-ticker-settings',
            array($this, 'admin_page')
        );
    }

    public function admin_page() {
        if (isset($_POST['submit'])) {
            update_option('crypto_ticker_show_homepage', isset($_POST['show_homepage']));
            update_option('crypto_ticker_show_posts', isset($_POST['show_posts']));
            update_option('crypto_ticker_default_coins', sanitize_text_field($_POST['default_coins']));
            echo '<div class="notice notice-success"><p>Settings saved!</p></div>';
        }

        $show_homepage = get_option('crypto_ticker_show_homepage', true);
        $show_posts = get_option('crypto_ticker_show_posts', true);
        $default_coins = get_option('crypto_ticker_default_coins', 'bitcoin,ethereum,cardano');
        ?>
        <div class="wrap">
            <h1>Crypto Ticker Settings</h1>
            <form method="post" action="">
                <table class="form-table">
                    <tr>
                        <th scope="row">Show on Homepage</th>
                        <td>
                            <input type="checkbox" name="show_homepage" value="1" <?php checked($show_homepage); ?>>
                            <label>Display ticker on homepage</label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Show on Posts</th>
                        <td>
                            <input type="checkbox" name="show_posts" value="1" <?php checked($show_posts); ?>>
                            <label>Display ticker on single posts</label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row">Default Coins</th>
                        <td>
                            <input type="text" name="default_coins" value="<?php echo esc_attr($default_coins); ?>" class="regular-text">
                            <p class="description">Comma-separated list of coin IDs (e.g., bitcoin,ethereum,cardano)</p>
                        </td>
                    </tr>
                </table>
                <?php submit_button(); ?>
            </form>

            <h2>Usage</h2>
            <p>You can use the shortcode <code>[crypto_ticker]</code> anywhere in your content.</p>
            <p>Available parameters:</p>
            <ul>
                <li><strong>coins</strong>: Comma-separated list of coin IDs (default: bitcoin,ethereum,cardano)</li>
                <li><strong>show_name</strong>: Show coin name (default: true)</li>
                <li><strong>show_symbol</strong>: Show coin symbol (default: true)</li>
                <li><strong>auto_update</strong>: Auto-update every minute (default: true)</li>
            </ul>

            <h3>Examples:</h3>
            <code>[crypto_ticker coins="bitcoin,ethereum" show_name="false"]</code><br>
            <code>[crypto_ticker coins="cardano,polkadot,chainlink" auto_update="false"]</code>

            <h3>Debug Information:</h3>
            <p><strong>WordPress Version:</strong> <?php echo get_bloginfo('version'); ?></p>
            <p><strong>Script Modules Support:</strong> <?php echo function_exists('wp_register_script_module') ? 'Yes' : 'No'; ?></p>
            <p><strong>Plugin URL:</strong> <?php echo CRYPTO_TICKER_PLUGIN_URL; ?></p>
            <p><strong>JS File:</strong> <?php echo CRYPTO_TICKER_PLUGIN_URL . 'assets/js/interactivity.js'; ?></p>
            <p><strong>File exists:</strong> <?php echo file_exists(CRYPTO_TICKER_PLUGIN_PATH . 'assets/js/interactivity.js') ? 'Yes' : 'No'; ?></p>
        </div>
        <?php
    }
}

// Initialize plugin
new CryptocurrencyTicker();

// Activation and deactivation hooks
register_activation_hook(__FILE__, 'crypto_ticker_activate');
register_deactivation_hook(__FILE__, 'crypto_ticker_deactivate');

function crypto_ticker_activate() {
    // Set default settings
    add_option('crypto_ticker_show_homepage', true);
    add_option('crypto_ticker_show_posts', true);
    add_option('crypto_ticker_default_coins', 'bitcoin,ethereum,cardano');
}

function crypto_ticker_deactivate() {
    // Clear cache and temporary data
    wp_clear_scheduled_hook('crypto_ticker_update_prices');
}