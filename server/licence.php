<?php
/**
 * Hairline licence proxy for Creem (https://creem.io).
 *
 * Creem's licence endpoints need your secret API key, which must never ship inside the extension.
 * This file holds the key on your server and forwards only the three licence calls the extension
 * makes. Drop it on any PHP 8+ host with the curl extension, e.g. https://hairline.app/licence.php.
 *
 *   POST licence.php?action=activate    { "key": "...", "instance_name": "..." }
 *   POST licence.php?action=validate    { "key": "...", "instance_id": "..." }
 *   POST licence.php?action=deactivate  { "key": "...", "instance_id": "..." }
 *
 * Every reply is JSON: { "valid": bool, "instance_id"?: string, "error"?: string }.
 * Keys for other Creem products are rejected, so a key for something else can't unlock Hairline.
 *
 * Configuration: copy config.example.php to config.php (keep it outside your web root if you can,
 * and point HAIRLINE_CONFIG at it) or set the same names as environment variables.
 */

declare(strict_types=1);

const ACTIONS = ['activate', 'validate', 'deactivate'];
const RATE_LIMIT = 30;          // requests per IP …
const RATE_WINDOW = 600;        // … per 10 minutes

function config(): array
{
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = getenv('HAIRLINE_CONFIG') ?: __DIR__ . '/config.php';
    $fromFile = is_file($file) ? (require $file) : [];
    $get = fn(string $name, $default = '') => getenv($name) !== false ? getenv($name) : ($fromFile[$name] ?? $default);
    return $cfg = [
        'api_key' => (string) $get('CREEM_API_KEY'),
        'product_id' => (string) $get('CREEM_PRODUCT_ID'),
        'api_base' => rtrim((string) $get('CREEM_API_BASE', 'https://api.creem.io'), '/'),
        'rate_dir' => (string) $get('HAIRLINE_RATE_DIR', sys_get_temp_dir() . '/hairline-rate'),
    ];
}

function reply(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES);
    exit;
}

/** Only the extension (chrome-extension:// origins) may call this from a browser. */
function cors(): void
{
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (preg_match('#^chrome-extension://[a-p]{32}$#', $origin)) {
        header("Access-Control-Allow-Origin: $origin");
        header('Vary: Origin');
        header('Access-Control-Allow-Methods: POST, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
        header('Access-Control-Max-Age: 86400');
    }
}

/** Simple per-IP fixed-window limiter, so the endpoint can't be used to brute-force keys. */
function rateLimit(string $dir): void
{
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) return; // fail open if storage is unavailable
    $file = $dir . '/' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $now = time();
    $fh = @fopen($file, 'c+');
    if (!$fh) return;
    flock($fh, LOCK_EX);
    [$start, $count] = array_map('intval', explode(':', stream_get_contents($fh) ?: '0:0') + [0, 0]);
    if ($now - $start >= RATE_WINDOW) [$start, $count] = [$now, 0];
    $count++;
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, "$start:$count");
    flock($fh, LOCK_UN);
    fclose($fh);
    if ($count > RATE_LIMIT) reply(429, ['valid' => false, 'error' => 'Too many attempts. Please wait a few minutes and try again.']);
}

/** POSTs JSON to Creem and returns [httpStatus, decodedBody]. */
function creem(string $path, array $body): array
{
    $cfg = config();
    $ch = curl_init($cfg['api_base'] . $path);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json', 'x-api-key: ' . $cfg['api_key']],
        CURLOPT_POSTFIELDS => json_encode($body),
    ]);
    $raw = curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($raw === false) reply(502, ['valid' => false, 'error' => 'Could not reach the licence server. Please try again.']);
    return [$status, json_decode((string) $raw, true) ?: []];
}

/** True when Creem says the key is active and belongs to Hairline's product. */
function isHairlineKey(array $licence): bool
{
    $product = config()['product_id'];
    $licenceProduct = (string) ($licence['product_id'] ?? $licence['product']['id'] ?? '');
    return ($licence['status'] ?? '') === 'active' && ($product === '' || $licenceProduct === $product);
}

// ---------------------------------------------------------------- request
cors();
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') reply(204, []);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reply(405, ['valid' => false, 'error' => 'Use POST.']);
if (config()['api_key'] === '') reply(500, ['valid' => false, 'error' => 'Licence server is not configured.']);

$action = $_GET['action'] ?? '';
if (!in_array($action, ACTIONS, true)) reply(404, ['valid' => false, 'error' => 'Unknown action.']);
rateLimit(config()['rate_dir']);

$in = json_decode((string) file_get_contents('php://input', false, null, 0, 4096), true);
$key = is_array($in) ? trim((string) ($in['key'] ?? '')) : '';
$instanceId = is_array($in) ? trim((string) ($in['instance_id'] ?? '')) : '';
$instanceName = is_array($in) ? trim((string) ($in['instance_name'] ?? '')) : '';
if ($key === '' || strlen($key) > 200) reply(400, ['valid' => false, 'error' => 'Enter your licence key.']);
if ($action !== 'activate' && ($instanceId === '' || strlen($instanceId) > 200)) reply(400, ['valid' => false, 'error' => 'Missing instance.']);

switch ($action) {
    case 'activate':
        [$status, $licence] = creem('/v1/licenses/activate', ['key' => $key, 'instance_name' => substr($instanceName ?: 'Hairline', 0, 100)]);
        if ($status >= 400 || !isHairlineKey($licence)) {
            reply(200, ['valid' => false, 'error' => $status === 404 || $status === 400 ? 'This licence key is not valid for Hairline.' : 'This licence key could not be activated. It may have reached its activation limit.']);
        }
        $id = (string) ($licence['instance']['id'] ?? ($licence['instance'][0]['id'] ?? ''));
        if ($id === '') reply(200, ['valid' => false, 'error' => 'This licence key could not be activated.']);
        reply(200, ['valid' => true, 'instance_id' => $id]);

    case 'validate':
        [$status, $licence] = creem('/v1/licenses/validate', ['key' => $key, 'instance_id' => $instanceId]);
        if ($status >= 500) reply(502, ['valid' => false, 'error' => 'Licence server unavailable.']); // extension keeps its grace period
        reply(200, ['valid' => $status < 400 && isHairlineKey($licence)]);

    case 'deactivate':
        [$status] = creem('/v1/licenses/deactivate', ['key' => $key, 'instance_id' => $instanceId]);
        reply(200, ['valid' => false, 'deactivated' => $status < 400]);
}
