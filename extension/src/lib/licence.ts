/**
 * Licensing via Lemon Squeezy's public License API (no secret key required in the client).
 * https://docs.lemonsqueezy.com/api/license-api
 * Swap CONFIG to move to Paddle or another vendor; only validate()/activate() need changing.
 */
export const CONFIG = {
  apiBase: 'https://api.lemonsqueezy.com/v1/licenses',
  /** Set to your Lemon Squeezy store/product IDs so keys from other products are rejected. */
  storeId: 0,
  productId: 0,
  checkoutUrl: 'https://hairline.example.com/pricing',
  /** Days a cached validation stays trusted while offline. */
  graceDays: 14,
  /** Re-validate against the API at most this often (hours). */
  revalidateHours: 24,
};

export interface LicenceRecord {
  key: string;
  instanceId: string;
  validatedAt: number;
  valid: boolean;
}

const KEY = 'licence';

export async function getRecord(): Promise<LicenceRecord | null> {
  const { [KEY]: rec } = await chrome.storage.local.get(KEY);
  return (rec as LicenceRecord | undefined) ?? null;
}

async function post(path: string, body: Record<string, string>) {
  const res = await fetch(`${CONFIG.apiBase}/${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  return (await res.json()) as {
    activated?: boolean;
    valid?: boolean;
    error?: string | null;
    instance?: { id: string };
    meta?: { store_id: number; product_id: number };
  };
}

function matchesProduct(meta?: { store_id: number; product_id: number }) {
  if (!CONFIG.storeId && !CONFIG.productId) return true; // unconfigured dev build
  return meta?.store_id === CONFIG.storeId && meta?.product_id === CONFIG.productId;
}

export async function activate(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await post('activate', { license_key: key.trim(), instance_name: `Hairline ${chrome.runtime.id}` });
    if (!data.activated || !data.instance || !matchesProduct(data.meta)) {
      return { ok: false, error: data.error ?? 'This licence key is not valid for Hairline.' };
    }
    await chrome.storage.local.set({
      [KEY]: { key: key.trim(), instanceId: data.instance.id, validatedAt: Date.now(), valid: true } satisfies LicenceRecord,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the licence server. Check your connection and try again.' };
  }
}

export async function deactivate(): Promise<void> {
  const rec = await getRecord();
  if (rec) {
    try {
      await post('deactivate', { license_key: rec.key, instance_id: rec.instanceId });
    } catch {
      /* offline: still clear locally */
    }
  }
  await chrome.storage.local.remove(KEY);
}

/** Returns whether Pro is unlocked, revalidating when the cache is stale. */
export async function isPro(): Promise<boolean> {
  const rec = await getRecord();
  if (!rec?.valid) return false;
  const age = Date.now() - rec.validatedAt;
  if (age < CONFIG.revalidateHours * 3_600_000) return true;
  try {
    const data = await post('validate', { license_key: rec.key, instance_id: rec.instanceId });
    const valid = !!data.valid && matchesProduct(data.meta);
    await chrome.storage.local.set({ [KEY]: { ...rec, valid, validatedAt: Date.now() } });
    return valid;
  } catch {
    return age < CONFIG.graceDays * 86_400_000; // offline grace period
  }
}
