// Sends WhatsApp notifications via Meta's WhatsApp Business Cloud API. Two
// kinds: an internal alert to the team when a new lead comes in, and a
// welcome message back to the customer who just submitted the form. Both
// no-op silently if their required env vars aren't set, so the booking flow
// keeps working (email-only) until each is configured.
//
// Shared env vars:
//   WHATSAPP_PHONE_NUMBER_ID  — the Cloud API sender's phone number ID
//                                (Meta for Developers > WhatsApp > API Setup)
//   WHATSAPP_ACCESS_TOKEN     — a permanent access token (via a System User
//                                in Meta Business Settings, not the 24h
//                                temporary token API Setup shows by default)
//
// Team alert only:
//   WHATSAPP_NOTIFY_TO           — comma-separated destination numbers in
//                                   E.164 without "+", e.g. "918383857710"
//   WHATSAPP_TEMPLATE_NAME       — default "new_lead_alert"
//   WHATSAPP_TEMPLATE_LANG       — default "en_US"
//
// Customer welcome message only:
//   WHATSAPP_STUDENT_TEMPLATE_NAME — default "student_welcome"
//   WHATSAPP_STUDENT_TEMPLATE_LANG — default "en"
//
// Both use approved message templates rather than freeform text — Meta only
// allows freeform text to a number that has messaged your WhatsApp Business
// number within the last 24 hours, which neither of these reliably
// satisfies. Templates must be created and approved in Meta Business
// Manager > WhatsApp Manager > Message Templates first, under the SAME
// WhatsApp Business Account that owns WHATSAPP_PHONE_NUMBER_ID — templates
// are approved per-account, not shared across your whole Meta Business
// portfolio.
//   new_lead_alert body variables (in order): {{1}} source, {{2}} name,
//     {{3}} program, {{4}} phone, {{5}} requested slot.
//   student_welcome body variables (in order): {{1}} name, {{2}} program.

async function sendTemplateMessage(to: string, templateName: string, templateLang: string, params: string[]): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return;

  const parameters = params.map((text) => ({ type: "text", text }));

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

    // fetch() only rejects on network failures -- it does NOT reject on HTTP
    // error responses like 400/401 from Meta. Without this check, an actual
    // rejection from Meta (bad template name, recipient not on the test
    // number's allow-list, expired token, etc.) would silently "succeed"
    // from this function's perspective with no log at all.
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`WhatsApp send to ${to} (${templateName}) rejected (${res.status}):`, body);
    }
  } catch (err) {
    // Best-effort — never let a WhatsApp failure block a booking.
    console.error(`WhatsApp send to ${to} (${templateName}) failed:`, err);
  }
}

// Meta's Cloud API wants digits only, no "+", full country code included.
// The booking form's country code selector (see CTA.tsx) means the phone
// field normally already carries one, so this is mostly a defensive
// fallback: a bare 10-digit entry (e.g. from a legacy/other caller) is
// assumed to be a local Indian mobile number and gets "91" prepended.
// Anything else is passed through as-is.
function toWhatsAppNumber(rawPhone: string): string {
  const digits = rawPhone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export interface LeadNotification {
  source: string;
  name: string;
  program: string;
  phone: string;
  slot: string;
}

export async function sendWhatsAppNotification(lead: LeadNotification): Promise<void> {
  const notifyTo = process.env.WHATSAPP_NOTIFY_TO;
  if (!notifyTo) return;

  const templateName = process.env.WHATSAPP_TEMPLATE_NAME || "new_lead_alert";
  const templateLang = process.env.WHATSAPP_TEMPLATE_LANG || "en_US";
  const recipients = notifyTo.split(",").map((n) => n.trim()).filter(Boolean);

  await Promise.all(
    recipients.map((to) =>
      sendTemplateMessage(to, templateName, templateLang, [lead.source, lead.name, lead.program, lead.phone, lead.slot])
    )
  );
}

export interface CustomerWelcome {
  name: string;
  program: string;
  phone: string;
}

export async function sendCustomerWelcomeMessage(customer: CustomerWelcome): Promise<void> {
  const to = toWhatsAppNumber(customer.phone);
  if (!to) return;

  const templateName = process.env.WHATSAPP_STUDENT_TEMPLATE_NAME || "student_welcome";
  const templateLang = process.env.WHATSAPP_STUDENT_TEMPLATE_LANG || "en";

  await sendTemplateMessage(to, templateName, templateLang, [customer.name, customer.program]);
}
