import { LocalStorageKeys } from '../../const'

type ChatMsg = { role: 'user' | 'assistant'; content: string; ts?: number };
type ChatHistoryResp = { chat_history: Record<string, ChatMsg[]> };

export type ChatExtractOpts = {
  days?: number;              // default 30
  maxConversations?: number;  // default 50
  halfLifeDays?: number;
};

/** Remove tracking params like ?utm_source=… (and any utm_*). Keeps other params/hash. */
function normalizeUrl(raw: string): string {
  try {
    // leave internal/about URLs alone
    if (raw.startsWith('about:') || raw.startsWith('moz-extension:') || raw.startsWith('chrome:')) {
      return raw;
    }
    const u = new URL(raw);
    const toDelete: string[] = [];
    u.searchParams.forEach((_, k) => {
      if (k.toLowerCase().startsWith('utm_')) toDelete.push(k);
    });
    toDelete.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    // not a parseable absolute URL — just return original
    return raw;
  }
}

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 1e4) / 1e4;

function freshnessScore(lastTs: number, nowMs: number, halfLifeDays: number): number {
  if (!lastTs) return 0;
  const ageDays = (nowMs - lastTs) / 86_400_000;
  if (ageDays <= 0) return 1;
  const hl = Math.max(halfLifeDays, 0.1); // avoid divide-by-zero
  const score = Math.exp(-Math.LN2 * (ageDays / hl));
  const clamped = Math.max(0, Math.min(1, score));
  return round4(clamped);
}

export function userChatsByUrl(
  input: ChatHistoryResp,
  opts?: ChatExtractOpts
) {
  const days = opts?.days ?? 30;
  const maxConversations = opts?.maxConversations ?? 50;
  const startTime = Date.now() - days * 86400 * 1000;
  const halfLifeDays = opts?.halfLifeDays ?? 14;
  const nowMs = Date.now();

  const agg = new Map<string, { messages: string[]; lastTs: number }>();

  const map = input?.chat_history ?? {};
  for (const [urlRaw, msgs] of Object.entries(map)) {
    if (!Array.isArray(msgs)) continue;

    const url = normalizeUrl(urlRaw);

    for (const m of msgs) {
      if (m?.role !== 'user') continue;
      if (typeof m.content !== 'string') continue;
      const content = m.content.trim();
      if (!content) continue;

      const ts = Number(m.ts ?? 0);
      if (ts && ts < startTime) continue; // skip older than N days (if timestamp exists)

      if (!agg.has(url)) agg.set(url, { messages: [], lastTs: 0 });
      const bucket = agg.get(url)!;

      // de-dup per URL
      if (!bucket.messages.includes(content)) {
        bucket.messages.push(content);
      }
      if (ts > bucket.lastTs) bucket.lastTs = ts;
    }
  }

  // Build, sort (newest first), clamp to maxConversations
  const result = Array.from(agg.entries())
    .map(([url, { messages, lastTs }]) => ({
      url,
      messages,
      lastTs,
      freshness_score: freshnessScore(lastTs, nowMs, halfLifeDays),
    }))
    .filter(x => x.messages.length > 0)
    .sort((a, b) => (b.freshness_score - a.freshness_score) || (b.lastTs - a.lastTs))
    .slice(0, maxConversations)
    .map(({ lastTs, ...rest }) => rest); // drop helper field

  return result as { url: string; messages: string[]; freshness_score: number }[];
}

export async function getChatHistory(): Promise<ChatHistoryResp> {
  const key = LocalStorageKeys.CHAT_HISTORY ?? 'chat_history';
  const resp = await browser.storage.local.get(key) as Record<string, unknown>;
  const chat_history = (resp[key] ?? {}) as Record<string, ChatMsg[]>;
  return { chat_history };
}

export async function getUserChats(opts?: ChatExtractOpts) {
  const data = await getChatHistory();
  return userChatsByUrl(data, opts);
}
