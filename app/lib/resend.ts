// Sends transactional email via Resend instead of Gmail SMTP -- nodemailer
// + a Gmail app password kept failing auth and was fragile to begin with.
// Reuses the same verified sending domain the LMS already sends from.
//
// Required env vars:
//   RESEND_API_KEY — from resend.com/api-keys (the same account/key the LMS
//                     uses works fine here too; a Resend key can only send
//                     email, not read data, so sharing it carries much less
//                     risk than sharing a Supabase service-role key would).
const FROM_EMAIL = "UniEDD Academy <no-reply@uniedd.com>";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`Email not sent (RESEND_API_KEY not configured) -- "${subject}" to ${to}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend send to ${to} rejected (${res.status}): ${body}`);
  }
}
