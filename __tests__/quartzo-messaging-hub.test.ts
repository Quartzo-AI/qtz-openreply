import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forwardInstagramDmToHub } from "@/lib/quartzo-messaging-hub";

describe("forwardInstagramDmToHub", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.QUARTZO_MESSAGING_WEBHOOK_URL;
    delete process.env.MESSAGING_WEBHOOK_SECRET;
    delete process.env.QUARTZO_WORKSPACE_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("no-ops cleanly when hub env vars are not configured", async () => {
    const mockFetch = vi.fn();
    const res = await forwardInstagramDmToHub(
      {
        instagramAccountId: "ig-acc-1",
        messageId: "mid-1",
        messageText: "Oi",
        senderId: "ig-user-1",
      },
      mockFetch as unknown as typeof fetch
    );

    expect(res).toEqual({ forwarded: false, reason: "hub_not_configured" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts normalized Instagram DM payload with webhook secret when configured", async () => {
    process.env.QUARTZO_MESSAGING_WEBHOOK_URL =
      "https://app.quartzo.ai/api/messaging/v1/webhooks/instagram";
    process.env.MESSAGING_WEBHOOK_SECRET = "test-secret";
    process.env.QUARTZO_WORKSPACE_ID = "ws-123";

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const res = await forwardInstagramDmToHub(
      {
        instagramAccountId: "ig-acc-1",
        messageId: "mid-2",
        messageText: "Quero saber mais",
        senderId: "ig-user-99",
      },
      mockFetch as unknown as typeof fetch
    );

    expect(res).toEqual({ forwarded: true, status: 200 });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://app.quartzo.ai/api/messaging/v1/webhooks/instagram"
    );
    expect(init.headers["x-messaging-webhook-secret"]).toBe("test-secret");
    const parsed = JSON.parse(init.body);
    expect(parsed.workspaceId).toBe("ws-123");
    expect(parsed.event.externalAccountId).toBe("ig-acc-1");
    expect(parsed.event.externalMessageId).toBe("mid-2");
    expect(parsed.event.contactExternalId).toBe("ig-user-99");
  });
});
