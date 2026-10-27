// Optional, explicitly selected external model provider. No dynamic endpoint URLs.
export const WORMGPT_ENDPOINT = 'https://api.wormgpt.live/v1/chat/completions';
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,95}$/;

export function wormgptConfigured(env) {
  return typeof env?.WORMGPT_API_KEY === 'string'
    && env.WORMGPT_API_KEY.length >= 16
    && typeof env.WORMGPT_MODEL_ID === 'string'
    && MODEL_ID.test(env.WORMGPT_MODEL_ID);
}

export async function invokeWormGPT(env, messages, maxOutputTokens, fetcher = fetch) {
  if (!wormgptConfigured(env)) throw new Error('WormGPT API credentials and model ID are not configured');
  if (!Array.isArray(messages) || !messages.length || messages.length > 16
    || !messages.every(m => m && ['system', 'user', 'assistant'].includes(m.role)
      && typeof m.content === 'string' && m.content.length <= 30000)
    || messages.reduce((n, m) => n + m.content.length, 0) > 65000) {
    throw new TypeError('Invalid provider conversation');
  }
  const max_tokens = Number.isFinite(maxOutputTokens)
    ? Math.max(128, Math.min(2048, Math.floor(maxOutputTokens))) : 1024;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetcher(WORMGPT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + env.WORMGPT_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ model: env.WORMGPT_MODEL_ID, messages, max_tokens, stream: false }),
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal
    });
    if (!response.ok) throw new Error('WormGPT API returned HTTP ' + response.status);
    if (!/application\/json/i.test(response.headers.get('content-type') || ''))
      throw new Error('WormGPT API returned an unexpected content type');
    const text = await response.text();
    if (text.length > 100000) throw new Error('WormGPT API response exceeds size limit');
    let data;
    try { data = JSON.parse(text); }
    catch { throw new Error('WormGPT API returned invalid JSON'); }
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== 'string' || !answer.trim() || answer.length > 20000)
      throw new Error('WormGPT API returned an invalid chat completion');
    return answer.trim();
  } finally {
    clearTimeout(timer);
  }
}
