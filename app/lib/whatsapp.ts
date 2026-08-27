// Sends a WhatsApp notification via Meta's WhatsApp Business Cloud API when a
// new lead comes in. No-ops silently if the required env vars aren't set, so
// the booking flow keeps working (email-only) until this is configured.
//
// Required env vars:
//   WHATSAPP_PHONE_NUMBER_ID  — the Cloud API sender's phone number ID
//                                (Meta for Developers > WhatsApp > API Setup)
//   WHATSAPP_ACCESS_TOKEN     — a permanent access token for that app
//   WHATSAPP_NOTIFY_TO        — comma-separated list of destination numbers
//                                in E.164 without "+", e.g. "918383857710"
//
// Caveat: Meta only allows freeform "text" messages to a number that has
// messaged your WhatsApp Business number within the last 24 hours. For
// reliable delivery to your team's phones outside that window, create an
// approved message template in Meta Business Manager and switch the request
// body below to a "template" message instead of "text".
export async function sendWhatsAppNotification(text: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const notifyTo = process.env.WHATSAPP_NOTIFY_TO;

  if (!phoneNumberId || !accessToken || !notifyTo) return;

  const recipients = notifyTo.split(",").map((n) => n.trim()).filter(Boolean);

  await Promise.all(
    recipients.map((to) =>
      fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text },
        }),
      }).catch((err) => {
        // Best-effort — never let a WhatsApp failure block a booking.
        console.error("WhatsApp notification failed:", err);
      })
    )
  );
}
