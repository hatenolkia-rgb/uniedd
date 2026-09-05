import { NextResponse, type NextRequest } from "next/server";
import { getSupabase } from "../../lib/supabase";
import { sendEmail } from "../../lib/resend";

interface QueuedLead {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string;
  phone: string;
  instrument: string;
  age_group: string | null;
  demo_date: string;
  demo_time: string;
  timezone: string | null;
  requires_payment: boolean;
  created_at: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Runs on a schedule (see vercel.json) — emails one summary of every lead
// collected since the last run, then clears them out of lead_digest_queue.
// Not a per-lead notification; that's WhatsApp's job (see api/contact).
export async function GET(request: NextRequest) {
  // Vercel injects this Authorization header automatically for its own Cron
  // Jobs once "Secure Cron Jobs" is enabled in Project Settings — this check
  // stops anyone else from triggering (and clearing) the queue on demand.
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return NextResponse.json({ error: "ADMIN_EMAIL not configured" }, { status: 500 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("lead_digest_queue")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("lead_digest_queue select error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const leads = (data as QueuedLead[]) || [];
  if (leads.length === 0) {
    return NextResponse.json({ sent: false, count: 0 });
  }

  const rows = leads
    .map((lead) => {
      const name = escapeHtml(`${lead.first_name} ${lead.last_name || ""}`.trim());
      return `
        <tr>
          <td style="padding:8px;border:1px solid #e5e5e5;">${name}</td>
          <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtml(lead.phone)}</td>
          <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtml(lead.email)}</td>
          <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtml(lead.instrument)}${lead.age_group ? ` (${escapeHtml(lead.age_group)})` : ""}</td>
          <td style="padding:8px;border:1px solid #e5e5e5;">${escapeHtml(lead.demo_date)} ${escapeHtml(lead.demo_time)}${lead.timezone ? ` (${escapeHtml(lead.timezone)})` : ""}</td>
          <td style="padding:8px;border:1px solid #e5e5e5;">${lead.requires_payment ? "₹199 (India)" : "Free"}</td>
        </tr>`;
    })
    .join("");

  try {
    await sendEmail({
      to: adminEmail,
      subject: `UniEDD — ${leads.length} new lead${leads.length === 1 ? "" : "s"} (last 24h)`,
      html: `
        <h2>${leads.length} new demo booking${leads.length === 1 ? "" : "s"}</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <thead>
            <tr style="background:#f7f7f7;text-align:left;">
              <th style="padding:8px;border:1px solid #e5e5e5;">Name</th>
              <th style="padding:8px;border:1px solid #e5e5e5;">Phone</th>
              <th style="padding:8px;border:1px solid #e5e5e5;">Email</th>
              <th style="padding:8px;border:1px solid #e5e5e5;">Program</th>
              <th style="padding:8px;border:1px solid #e5e5e5;">Requested slot</th>
              <th style="padding:8px;border:1px solid #e5e5e5;">Fee</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <br/>
        <p>Each lead was already sent to the team over WhatsApp when they booked — this is just the daily roll-up.</p>
      `,
    });
  } catch (mailError) {
    // Don't delete the queue below if the email never actually went out --
    // leave these rows for tomorrow's run to retry instead of losing them.
    console.error("Digest email failed:", mailError);
    return NextResponse.json({ error: "Digest email failed to send" }, { status: 502 });
  }

  const ids = leads.map((lead) => lead.id);
  const { error: deleteError } = await supabase.from("lead_digest_queue").delete().in("id", ids);
  if (deleteError) {
    // The email already sent successfully -- log this rather than fail the
    // request, otherwise Vercel Cron would retry and send a duplicate email.
    console.error("lead_digest_queue delete error:", deleteError);
  }

  return NextResponse.json({ sent: true, count: leads.length });
}
