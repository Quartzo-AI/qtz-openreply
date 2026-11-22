import { describe, expect, it, vi } from "vitest";
import {
  buildOpenReplyFunnelEvent,
  emitOpenReplyFunnelEvent,
  extractPecaId,
} from "@/lib/funnel/emitter";

describe("OpenReply funnel emitter (ADR-010)", () => {
  it("extracts canonical Peça ID from automation name when present", () => {
    expect(extractPecaId("Reel CrystalPass PC-2026-042")).toBe("PC-2026-042");
    expect(extractPecaId("DM sem peça")).toBeNull();
  });

  it("builds deterministic, PII-free payload with opaque IDs only", () => {
    const ev = buildOpenReplyFunnelEvent(
      {
        workspaceId: "ws_123",
        instagramAccountId: "ig_acc_456",
        automationId: "auto_789",
        automationName: "Campanha PC-ABCD-01",
        mediaId: "media_111",
        commentId: "cmt_222",
        recipientIgsid: "igsid_333",
        sentAt: new Date("2026-11-22T14:00:00.000Z"),
      },
      { FUNNEL_CLIENT_SLUG: "quartzo", FUNNEL_DEFAULT_OFFER: "crystalpass" }
    );

    expect(ev.tipo).toBe("ig_dm_sent");
    expect(ev.canal).toBe("INSTAGRAM");
    expect(ev.event_key).toBe("openreply:auto_789:cmt_222");
    expect(ev.lock_key).toBe("openreply:ws_123:igsid_333");
    expect(ev.campanha).toBe("PC-ABCD-01");
    expect(ev.oferta).toBe("crystalpass");
    expect(ev.payload).toEqual({
      source: "qtz-openreply",
      workspace_id: "ws_123",
      instagram_account_id: "ig_acc_456",
      automation_id: "auto_789",
      media_id: "media_111",
      comment_id: "cmt_222",
      recipient_igsid: "igsid_333",
      peca_id: "PC-ABCD-01",
      oferta: "crystalpass",
    });
    // Ensure no PII keys exist
    const serialized = JSON.stringify(ev);
    expect(serialized).not.toContain("username");
    expect(serialized).not.toContain("commentText");
    expect(serialized).not.toContain("email");
  });

  it("is a no-op when FUNNEL_ENQUEUE_URL is not configured", async () => {
    const fetchMock = vi.fn();
    const res = await emitOpenReplyFunnelEvent(
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        automationId: "auto_1",
        commentId: "cmt_1",
        recipientIgsid: "igsid_1",
      },
      { fetchImpl: fetchMock as unknown as typeof fetch, env: {} }
    );
    expect(res).toEqual({ sent: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs with Bearer token and fails open on HTTP/network errors", async () => {
    const okFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const ok = await emitOpenReplyFunnelEvent(
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        automationId: "auto_1",
        commentId: "cmt_1",
        recipientIgsid: "igsid_1",
      },
      {
        fetchImpl: okFetch as unknown as typeof fetch,
        env: {
          FUNNEL_ENQUEUE_URL: "https://n8n.quartzo.ai/webhook/funnel-enqueue",
          FUNNEL_ENQUEUE_TOKEN: "tok-test",
        },
      }
    );
    expect(ok).toEqual({ sent: true, status: 200 });
    expect(okFetch).toHaveBeenCalledOnce();
    const [url, init] = okFetch.mock.calls[0];
    expect(url).toBe("https://n8n.quartzo.ai/webhook/funnel-enqueue");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok-test",
    });

    const errFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const fail = await emitOpenReplyFunnelEvent(
      {
        workspaceId: "ws_1",
        instagramAccountId: "ig_1",
        automationId: "auto_1",
        commentId: "cmt_1",
        recipientIgsid: "igsid_1",
      },
      {
        fetchImpl: errFetch as unknown as typeof fetch,
        env: { FUNNEL_ENQUEUE_URL: "https://n8n.quartzo.ai/webhook/funnel-enqueue" },
      }
    );
    expect(fail.sent).toBe(false);
    expect(fail.error).toContain("ECONNREFUSED");
  });
});
