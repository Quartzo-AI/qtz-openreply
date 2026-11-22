export type InboundInstagramDmEvent = {
  instagramAccountId: string;
  messageId: string;
  messageText: string;
  senderId: string;
  timestamp?: string;
};

export type HubForwardResult =
  | { forwarded: true; status: number }
  | { forwarded: false; reason: string };

export async function forwardInstagramDmToHub(
  event: InboundInstagramDmEvent,
  fetchImpl: typeof fetch = fetch
): Promise<HubForwardResult> {
  const webhookUrl = (process.env.QUARTZO_MESSAGING_WEBHOOK_URL ?? "").trim();
  const secret = (process.env.MESSAGING_WEBHOOK_SECRET ?? "").trim();
  const workspaceId = (process.env.QUARTZO_WORKSPACE_ID ?? "").trim();

  if (!webhookUrl || !secret || !workspaceId) {
    return { forwarded: false, reason: "hub_not_configured" };
  }

  const res = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-messaging-webhook-secret": secret,
    },
    body: JSON.stringify({
      workspaceId,
      event: {
        externalAccountId: event.instagramAccountId,
        externalConversationId: event.senderId,
        externalMessageId: event.messageId,
        isGroup: false,
        contactExternalId: event.senderId,
        senderExternalId: event.senderId,
        body: event.messageText,
        timestamp: event.timestamp ?? new Date().toISOString(),
      },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    return { forwarded: false, reason: `http_${res.status}` };
  }

  return { forwarded: true, status: res.status };
}
