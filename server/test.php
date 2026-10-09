<?php
/**
 * End-to-end test for licence.php: runs a fake Creem API and the proxy on PHP's built-in server, then
 * exercises activate / validate / deactivate, product checks, CORS and rate limiting.
 *
 *   php server/test.php
 */

declare(strict_types=1);

$dir = sys_get_temp_dir() . '/hairline-licence-test-' . getmypid();
@mkdir($dir, 0700, true);

// Fake Creem: requires the API key, knows three licence keys.
file_put_contents("$dir/creem.php", <<<'PHP'
<?php
header('Content-Type: application/json');
if (($_SERVER['HTTP_X_API_KEY'] ?? '') !== 'creem_test') { http_response_code(401); echo '{"error":"unauthorized"}'; return true; }
$in = json_decode(file_get_contents('php://input'), true) ?: [];
$keys = ['GOOD' => 'prod_hairline', 'OTHER' => 'prod_other', 'DISABLED' => 'prod_hairline'];
$key = $in['key'] ?? '';
if (!isset($keys[$key])) { http_response_code(404); echo '{"error":"not found"}'; return true; }
$status = $key === 'DISABLED' ? 'disabled' : 'active';
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/v1/licenses/validate' && ($in['instance_id'] ?? '') !== 'ins_1') { http_response_code(404); echo '{"error":"instance"}'; return true; }
echo json_encode(['id' => 'lic_1', 'status' => $status, 'product_id' => $keys[$key], 'activation' => 1, 'activation_limit' => 3, 'instance' => ['id' => 'ins_1', 'name' => $in['instance_name'] ?? 'x', 'status' => 'active']]);
return true;
PHP);

$proxyDir = realpath(__DIR__);
$env = ['CREEM_API_KEY' => 'creem_test', 'CREEM_PRODUCT_ID' => 'prod_hairline', 'CREEM_API_BASE' => 'http://127.0.0.1:18731', 'HAIRLINE_RATE_DIR' => "$dir/rate", 'HAIRLINE_CONFIG' => "$dir/none.php"];
$creem = proc_open([PHP_BINARY, '-S', '127.0.0.1:18731', "$dir/creem.php"], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $p1);
$proxy = proc_open([PHP_BINARY, '-S', '127.0.0.1:18732', '-t', $proxyDir], [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']], $p2, null, $env + getenv());
usleep(600_000);

function call(string $action, array $body, array $headers = []): array
{
    $ch = curl_init("http://127.0.0.1:18732/licence.php?action=$action");
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true,
        CURLOPT_HTTPHEADER => array_merge(['Content-Type: application/json'], $headers), CURLOPT_POSTFIELDS => json_encode($body)]);
    $raw = (string) curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $hsize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return [$status, json_decode(substr($raw, $hsize), true), substr($raw, 0, $hsize)];
}

$fails = 0;
function check(string $name, bool $ok): void { global $fails; echo ($ok ? '  ✓ ' : '  ✗ ') . $name . "\n"; if (!$ok) $fails++; }

[$s, $r] = call('activate', ['key' => 'GOOD', 'instance_name' => 'Hairline abc']);
check('activate a Hairline key → valid + instance id', $s === 200 && $r['valid'] === true && $r['instance_id'] === 'ins_1');
[$s, $r] = call('activate', ['key' => 'OTHER']);
check('key for another product is rejected', $r['valid'] === false && str_contains($r['error'], 'could not be activated'));
[$s, $r] = call('activate', ['key' => 'NOPE']);
check('unknown key is rejected', $r['valid'] === false && str_contains($r['error'], 'not valid for Hairline'));
[$s, $r] = call('activate', ['key' => 'DISABLED']);
check('disabled key is rejected', $r['valid'] === false);
[$s, $r] = call('validate', ['key' => 'GOOD', 'instance_id' => 'ins_1']);
check('validate a good instance → valid', $r['valid'] === true);
[$s, $r] = call('validate', ['key' => 'GOOD', 'instance_id' => 'ins_9']);
check('validate a wrong instance → not valid', $r['valid'] === false);
[$s, $r] = call('validate', ['key' => 'GOOD']);
check('validate without instance → 400', $s === 400);
[$s, $r] = call('deactivate', ['key' => 'GOOD', 'instance_id' => 'ins_1']);
check('deactivate → ok', $s === 200 && $r['deactivated'] === true);
[$s, $r] = call('refund', ['key' => 'GOOD']);
check('unknown action → 404', $s === 404);
[$s, , $h] = call('validate', ['key' => 'GOOD', 'instance_id' => 'ins_1'], ['Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop']);
check('CORS allows chrome-extension origins', str_contains($h, 'Access-Control-Allow-Origin: chrome-extension://abcdefghijklmnopabcdefghijklmnop'));
[$s, , $h] = call('validate', ['key' => 'GOOD', 'instance_id' => 'ins_1'], ['Origin: https://evil.example']);
check('CORS ignores other origins', !str_contains($h, 'Access-Control-Allow-Origin'));
$limited = false;
for ($i = 0; $i < 30; $i++) { [$s] = call('validate', ['key' => 'GOOD', 'instance_id' => 'ins_1']); if ($s === 429) { $limited = true; break; } }
check('rate limit kicks in', $limited);

proc_terminate($creem); proc_terminate($proxy);
exec('rm -rf ' . escapeshellarg($dir));
echo $fails ? "\n$fails failed\n" : "\nAll licence proxy tests passed\n";
exit($fails ? 1 : 0);
