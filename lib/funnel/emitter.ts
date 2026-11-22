export interface OpenReplyFunnelEventInput {
  workspaceId: string;
  instagramAccountId: string;
  automationId: string;
  automationName?: string | null;
  mediaId?: string | null;
  commentId: string;
  recipientIgsid: string;
  sentAt?: Date;
}

export interface FunnelEnqueuePayload {
  tipo: "ig_dm_sent";
  event_key: string;
  lock_key: string;
  cliente: string;
  oferta: string | null;
  canal: "INSTAGRAM";
  campanha: string | null;
  ts: string;
  ref_externa: string;
  payload: {
    source: "qtz-openreply";
    workspace_id: string;
    instagram_account_id: string;
    automation_id: string;
    media_id: string | null;
    comment_id: string;
    recipient_igsid: string;
    peca_id: string | null;
    oferta: string | null;
  };
}

const PECA_ID_RE = /\b(PC-[A-Za-z0-9][A-Za-z0-9-]{2,60})\b/;

export function extractPecaId(text?: string | null): string | null {
  if (!text) return null;
  const match = PECA_ID_RE.exec(text);
  return match ? match[1] : null;
}

/**
 * Builds a strictly PII-free funnel event for the Quartzo Funnel Writer (ADR-010).
 * Only opaque IDs (workspace, account, automation, media, comment, IGSID, Peça ID)
 * cross into funnel_events / Twenty.
 */
export function buildOpenReplyFunnelEvent(
  input: OpenReplyFunnelEventInput,
  env: NodeJS.ProcessEnv = process.env
): FunnelEnqueuePayload {
  const pecaId = extractPecaId(input.automationName);
  const cliente = (env.FUNNEL_CLIENT_SLUG || "quartzo").trim() || "quartzo";
  const oferta = (env.FUNNEL_DEFAULT_OFFER || "").trim() || null;
  const ts = (input.sentAt ?? new Date()).toISOString();

  return {
    tipo: "ig_dm_sent",
    event_key: `openreply:${input.automationId}:${input.commentId}`,
    lock_key: `openreply:${input.workspaceId}:${input.recipientIgsid}`,
    cliente,
    oferta,
    canal: "INSTAGRAM",
    campanha: pecaId ?? `openreply:${input.automationId}`,
    ts,
    ref_externa: input.commentId,
    payload: {
      source: "qtz-openreply",
      workspace_id: input.workspaceId,
      instagram_account_id: input.instagramAccountId,
      automation_id: input.automationId,
      media_id: input.mediaId ?? null,
      comment_id: input.commentId,
      recipient_igsid: input.recipientIgsid,
      peca_id: pecaId,
      oferta,
    },
  };
}

/**
 * Emits an idempotent `ig_dm_sent` event to the Quartzo Funnel Enqueue webhook.
 * Fail-open: never throws or blocks DM delivery when unconfigured or unreachable.
 */
export async function emitOpenReplyFunnelEvent(
  input: OpenReplyFunnelEventInput,
  options?: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv }
): Promise<{ sent: boolean; skipped?: boolean; status?: number; error?: string }> {
  const env = options?.env ?? process.env;
  const url = (env.FUNNEL_ENQUEUE_URL || "").trim();
  if (!url) {
    return { sent: false, skipped: true };
  }

  const token = (env.FUNNEL_ENQUEUE_TOKEN || "").trim();
  const body = buildOpenReplyFunnelEvent(input, env);
  const fetchFn = options?.fetchImpl ?? fetch;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetchFn(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return { sent: false, status: res.status, error: `HTTP ${res.status}` };
    }
    return { sent: true, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[Funnel Emitter] Failed to emit ig_dm_sent:", message);
    return { sent: false, error: message };
  }
}
