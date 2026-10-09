/**
 * Licensing via Creem (https://creem.io), through the small PHP proxy in /server/licence.php.
 * Creem's licence API needs a secret API key, so the extension never talks to Creem directly: the
 * proxy holds the key, checks the key belongs to Hairline's product, and returns { valid, instance_id }.
 */
export const CONFIG = {
  /** Where server/licence.php is deployed. Also listed in manifest.json host_permissions. */
  licenceUrl: 'https://hairline.example.com/licence.php',
  /** Creem checkout link for Hairline Pro (Creem dashboard → Products → Share / payment link). */
  checkoutUrl: 'https://hairline.example.com/pricing',
  /** Days a cached validation stays trusted while offline. */
  graceDays: 14,
  /** Re-validate at most this often (hours). */
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

interface ProxyReply { valid: boolean; instance_id?: string; error?: string }

/** Calls the licence proxy. Throws on network failure or a server error (5xx), so callers can apply the grace period. */
async function post(action: 'activate' | 'validate' | 'deactivate', body: Record<string, string>): Promise<ProxyReply> {
  const res = await fetch(`${CONFIG.licenceUrl}?action=${action}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status >= 500) throw new Error(`licence server ${res.status}`);
  return (await res.json()) as ProxyReply;
}

export async function activate(key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const data = await post('activate', { key: key.trim(), instance_name: `Hairline ${chrome.runtime.id}` });
    if (!data.valid || !data.instance_id) return { ok: false, error: data.error ?? 'This licence key is not valid for Hairline.' };
    await chrome.storage.local.set({
      [KEY]: { key: key.trim(), instanceId: data.instance_id, validatedAt: Date.now(), valid: true } satisfies LicenceRecord,
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
      await post('deactivate', { key: rec.key, instance_id: rec.instanceId });
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
    const { valid } = await post('validate', { key: rec.key, instance_id: rec.instanceId });
    await chrome.storage.local.set({ [KEY]: { ...rec, valid: !!valid, validatedAt: Date.now() } });
    return !!valid;
  } catch {
    return age < CONFIG.graceDays * 86_400_000; // offline or server down: grace period
  }
}
