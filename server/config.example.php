<?php
// Copy to config.php (ideally outside your web root, then set HAIRLINE_CONFIG to its path).
// Never commit the real file: it holds your secret Creem API key.
return [
    // Creem dashboard → Developers → API keys. Use a test-mode key while testing.
    'CREEM_API_KEY' => 'creem_xxxxxxxxxxxxxxxxxxxx',
    // Creem dashboard → Products → Hairline Pro → product ID (prod_…). Keys for other products are rejected.
    'CREEM_PRODUCT_ID' => 'prod_xxxxxxxxxxxxxxxx',
    // https://api.creem.io for live, https://test-api.creem.io for test mode.
    'CREEM_API_BASE' => 'https://api.creem.io',
];
