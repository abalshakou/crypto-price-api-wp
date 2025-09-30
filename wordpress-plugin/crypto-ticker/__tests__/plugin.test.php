<?php
/**
 * Unit tests for Cryptocurrency Ticker WordPress Plugin
 * 
 * To run these tests, you need PHPUnit and WordPress test environment
 * Setup: https://make.wordpress.org/core/handbook/testing/automated-testing/phpunit/
 */

class CryptocurrencyTickerTest extends WP_UnitTestCase {

    private $plugin;

    public function setUp(): void {
        parent::setUp();
        
        // Include the plugin file
        require_once dirname(__DIR__) . '/crypto-ticker.php';
        $this->plugin = new CryptocurrencyTicker();
    }

    public function tearDown(): void {
        parent::tearDown();
        
        // Clean up options
        delete_option('crypto_ticker_show_homepage');
        delete_option('crypto_ticker_show_posts');
        delete_option('crypto_ticker_default_coins');
    }

    /**
     * Test plugin initialization
     */
    public function test_plugin_initialization() {
        $this->assertInstanceOf('CryptocurrencyTicker', $this->plugin);
        
        // Check if hooks are registered
        $this->assertEquals(10, has_action('init', array($this->plugin, 'init')));
        $this->assertEquals(10, has_action('wp_enqueue_scripts', array($this->plugin, 'enqueue_scripts')));
        $this->assertEquals(10, has_action('wp_head', array($this->plugin, 'add_inline_styles')));
        $this->assertEquals(10, has_action('wp_footer', array($this->plugin, 'display_ticker')));
        $this->assertEquals(10, has_action('admin_menu', array($this->plugin, 'add_admin_menu')));
        
        // Check if shortcode is registered
        $this->assertTrue(shortcode_exists('crypto_ticker'));
        
        // Check if AJAX actions are registered
        $this->assertEquals(10, has_action('wp_ajax_get_crypto_price', array($this->plugin, 'ajax_get_crypto_price')));
        $this->assertEquals(10, has_action('wp_ajax_nopriv_get_crypto_price', array($this->plugin, 'ajax_get_crypto_price')));
    }

    /**
     * Test shortcode rendering
     */
    public function test_shortcode_rendering() {
        $output = $this->plugin->render_shortcode(array(
            'coins' => 'bitcoin,ethereum',
            'show_name' => 'true',
            'show_symbol' => 'true',
            'auto_update' => 'true'
        ));

        $this->assertNotEmpty($output);
        $this->assertStringContainsString('crypto-ticker', $output);
        $this->assertStringContainsString('data-wp-interactive="crypto-ticker"', $output);
        $this->assertStringContainsString('bitcoin', $output);
        $this->assertStringContainsString('ethereum', $output);
    }

    /**
     * Test shortcode with default parameters
     */
    public function test_shortcode_default_parameters() {
        $output = $this->plugin->render_shortcode(array());

        $this->assertStringContainsString('bitcoin', $output);
        $this->assertStringContainsString('ethereum', $output);
        $this->assertStringContainsString('cardano', $output);
    }

    /**
     * Test shortcode with custom parameters
     */
    public function test_shortcode_custom_parameters() {
        $output = $this->plugin->render_shortcode(array(
            'coins' => 'dogecoin',
            'show_name' => 'false',
            'show_symbol' => 'true',
            'auto_update' => 'false'
        ));

        $this->assertStringContainsString('dogecoin', $output);
        $this->assertStringNotContainsString('crypto-ticker__name', $output);
        $this->assertStringContainsString('crypto-ticker__symbol', $output);
    }

    /**
     * Test activation hook
     */
    public function test_activation_hook() {
        crypto_ticker_activate();

        $this->assertTrue(get_option('crypto_ticker_show_homepage'));
        $this->assertTrue(get_option('crypto_ticker_show_posts'));
        $this->assertEquals('bitcoin,ethereum,cardano', get_option('crypto_ticker_default_coins'));
    }

    /**
     * Test AJAX price fetching with valid data
     */
    public function test_ajax_get_crypto_price_valid() {
        // Mock WordPress functions
        $_POST['nonce'] = wp_create_nonce('crypto_ticker_nonce');
        $_POST['coin_id'] = 'bitcoin';

        // Mock wp_remote_get response
        add_filter('pre_http_request', function($response, $args, $url) {
            if (strpos($url, 'crypto-api:3000/price/bitcoin') !== false) {
                return array(
                    'response' => array('code' => 200),
                    'body' => json_encode(array(
                        'name' => 'Bitcoin',
                        'symbol' => 'BTC',
                        'price' => 45000.50
                    ))
                );
            }
            return $response;
        }, 10, 3);

        // Capture output
        ob_start();
        $this->plugin->ajax_get_crypto_price();
        $output = ob_get_clean();

        $response = json_decode($output, true);
        $this->assertTrue($response['success']);
        $this->assertEquals('Bitcoin', $response['data']['name']);
        $this->assertEquals('BTC', $response['data']['symbol']);
        $this->assertEquals(45000.50, $response['data']['price']);
    }

    /**
     * Test AJAX price fetching with invalid nonce
     */
    public function test_ajax_get_crypto_price_invalid_nonce() {
        $_POST['nonce'] = 'invalid_nonce';
        $_POST['coin_id'] = 'bitcoin';

        $this->expectException('WPDieException');
        $this->plugin->ajax_get_crypto_price();
    }

    /**
     * Test AJAX price fetching with missing coin ID
     */
    public function test_ajax_get_crypto_price_missing_coin_id() {
        $_POST['nonce'] = wp_create_nonce('crypto_ticker_nonce');
        $_POST['coin_id'] = '';

        ob_start();
        $this->plugin->ajax_get_crypto_price();
        $output = ob_get_clean();

        $response = json_decode($output, true);
        $this->assertFalse($response['success']);
        $this->assertEquals('Coin ID is required', $response['data']);
    }

    /**
     * Test AJAX price fetching with API error
     */
    public function test_ajax_get_crypto_price_api_error() {
        $_POST['nonce'] = wp_create_nonce('crypto_ticker_nonce');
        $_POST['coin_id'] = 'invalid-coin';

        // Mock wp_remote_get error response
        add_filter('pre_http_request', function($response, $args, $url) {
            return array(
                'response' => array('code' => 404),
                'body' => json_encode(array(
                    'error' => 'Cryptocurrency not found',
                    'message' => 'The specified cryptocurrency ID does not exist'
                ))
            );
        }, 10, 3);

        ob_start();
        $this->plugin->ajax_get_crypto_price();
        $output = ob_get_clean();

        $response = json_decode($output, true);
        $this->assertFalse($response['success']);
        $this->assertStringContainsString('cryptocurrency ID does not exist', $response['data']);
    }

    /**
     * Test display ticker conditions
     */
    public function test_display_ticker_homepage() {
        update_option('crypto_ticker_show_homepage', true);
        update_option('crypto_ticker_show_posts', false);
        update_option('crypto_ticker_default_coins', 'bitcoin');

        // Mock is_home() to return true
        global $wp_query;
        $wp_query->is_home = true;

        ob_start();
        $this->plugin->display_ticker();
        $output = ob_get_clean();

        $this->assertStringContainsString('crypto-ticker', $output);
        $this->assertStringContainsString('bitcoin', $output);
    }

    /**
     * Test display ticker on single posts
     */
    public function test_display_ticker_single_post() {
        update_option('crypto_ticker_show_homepage', false);
        update_option('crypto_ticker_show_posts', true);
        update_option('crypto_ticker_default_coins', 'ethereum');

        // Mock is_single() to return true
        global $wp_query;
        $wp_query->is_single = true;

        ob_start();
        $this->plugin->display_ticker();
        $output = ob_get_clean();

        $this->assertStringContainsString('crypto-ticker', $output);
        $this->assertStringContainsString('ethereum', $output);
    }

    /**
     * Test that ticker doesn't display when disabled
     */
    public function test_display_ticker_disabled() {
        update_option('crypto_ticker_show_homepage', false);
        update_option('crypto_ticker_show_posts', false);

        ob_start();
        $this->plugin->display_ticker();
        $output = ob_get_clean();

        $this->assertEmpty($output);
    }

    /**
     * Test inline styles are added
     */
    public function test_add_inline_styles() {
        ob_start();
        $this->plugin->add_inline_styles();
        $output = ob_get_clean();

        $this->assertStringContainsString('<style>', $output);
        $this->assertStringContainsString('.crypto-ticker', $output);
        $this->assertStringContainsString('.crypto-ticker__container', $output);
        $this->assertStringContainsString('</style>', $output);
    }

    /**
     * Test script enqueuing for modern WordPress
     */
    public function test_enqueue_scripts_modern_wordpress() {
        // Mock WordPress version 6.5+
        global $wp_version;
        $original_version = $wp_version;
        $wp_version = '6.5.0';

        // Mock function_exists for script modules
        if (!function_exists('wp_register_script_module')) {
            function wp_register_script_module() { return true; }
        }

        $this->plugin->enqueue_scripts();

        // Check if script module was registered
        $this->assertTrue(wp_script_module_is('crypto-ticker-interactivity', 'registered'));

        $wp_version = $original_version;
    }

    /**
     * Test script enqueuing fallback for older WordPress
     */
    public function test_enqueue_scripts_fallback() {
        global $wp_version;
        $original_version = $wp_version;
        $wp_version = '6.0.0';

        $this->plugin->enqueue_scripts();

        // Check if fallback script was enqueued
        $this->assertTrue(wp_script_is('crypto-ticker-interactivity', 'enqueued'));

        $wp_version = $original_version;
    }

    /**
     * Test admin menu registration
     */
    public function test_admin_menu() {
        global $admin_page_hooks;
        
        $this->plugin->add_admin_menu();
        
        // Check if options page was added
        $this->assertArrayHasKey('options-general.php', $admin_page_hooks);
    }

    /**
     * Test deactivation hook
     */
    public function test_deactivation_hook() {
        // Schedule a fake cron event
        wp_schedule_event(time(), 'hourly', 'crypto_ticker_update_prices');
        $this->assertNotFalse(wp_next_scheduled('crypto_ticker_update_prices'));

        crypto_ticker_deactivate();

        // Check if scheduled event was cleared
        $this->assertFalse(wp_next_scheduled('crypto_ticker_update_prices'));
    }
}

/**
 * Integration tests for the complete plugin functionality
 */
class CryptocurrencyTickerIntegrationTest extends WP_UnitTestCase {

    /**
     * Test complete shortcode workflow
     */
    public function test_complete_shortcode_workflow() {
        // Test shortcode parsing
        $content = 'Check out these prices: [crypto_ticker coins="bitcoin,ethereum"] End of content.';
        $processed = do_shortcode($content);

        $this->assertStringContainsString('crypto-ticker', $processed);
        $this->assertStringContainsString('bitcoin', $processed);
        $this->assertStringContainsString('ethereum', $processed);
        $this->assertStringContainsString('Check out these prices:', $processed);
        $this->assertStringContainsString('End of content.', $processed);
    }

    /**
     * Test plugin with real WordPress environment
     */
    public function test_plugin_with_wordpress_environment() {
        // Create a test post
        $post_id = $this->factory->post->create(array(
            'post_title' => 'Test Post with Crypto Ticker',
            'post_content' => '[crypto_ticker coins="bitcoin"]',
            'post_status' => 'publish'
        ));

        // Get the post content with shortcodes processed
        $post = get_post($post_id);
        $content = apply_filters('the_content', $post->post_content);

        $this->assertStringContainsString('crypto-ticker', $content);
        $this->assertStringContainsString('bitcoin', $content);
    }
}
?>