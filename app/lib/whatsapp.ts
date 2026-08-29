// Sends a WhatsApp notification via Meta's WhatsApp Business Cloud API when a
// new lead comes in. No-ops silently if the required env vars aren't set, so
// the booking flow keeps working (email-only) until this is configured.
//
// Required env vars:
//   WHATSAPP_PHONE_NUMBER_ID  — the Cloud API sender's phone number ID
//                                (Meta for Developers > WhatsApp > API Setup)
//   WHATSAPP_ACCESS_TOKEN     — a permanent access token (via a System User
//                                in Meta Business Settings, not the 24h
//                                temporary token API Setup shows by default)
//   WHATSAPP_NOTIFY_TO        — comma-separated destination numbers in
//                                E.164 without "+", e.g. "918383857710"
//
// Optional:
//   WHATSAPP_TEMPLATE_NAME    — default "new_lead_alert"
//   WHATSAPP_TEMPLATE_LANG    — default "en_US"
//
// Uses an approved message template rather than freeform text — Meta only
// allows freeform text to a number that has messaged your WhatsApp Business
// number within the last 24 hours, which internal team notifications won't
// reliably satisfy. The template must be created and approved in Meta
// Business Manager > WhatsApp Manager > Message Templates first, with a
// body matching (in order): {{1}} source, {{2}} name, {{3}} program,
// {{4}} phone, {{5}} requested slot.
export interface LeadNotification {
  source: string;
  name: string;
  program: string;
  phone: string;
  slot: string;
}

export async function sendWhatsAppNotification(lead: LeadNotification): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const notifyTo = process.env.WHATSAPP_NOTIFY_TO;

  if (!phoneNumberId || !accessToken || !notifyTo) return;

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "new_lead_alert";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";
  const recipients = notifyTo.split(",").map((n) => n.trim()).filter(Boolean);

  const parameters = [lead.source, lead.name, lead.program, lead.phone, lead.slot].map((text) => ({
    type: "text",
    text,
  }));

  await Promise.all(
    recipients.map(async (to) => {
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: templateName,
              language: { code: templateLang },
              components: [{ type: "body", parameters }],
            },
          }),
        });

        // fetch() only rejects on network failures -- it does NOT reject on
        // HTTP error responses like 400/401 from Meta. Without this check,
        // an actual rejection from Meta (bad template name, recipient not
        // on the test number's allow-list, expired token, etc.) would
        // silently "succeed" from this function's perspective with no log
        // at all, making it look like nothing was ever attempted.
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`WhatsApp send to ${to} rejected (${res.status}):`, body);
        }
      } catch (err) {
        // Best-effort — never let a WhatsApp failure block a booking.
        console.error(`WhatsApp send to ${to} failed:`, err);
      }
    })
  );
}
