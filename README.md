# UniEDD website

Marketing site for [uniedd.com](https://uniedd.com): live 1:1 online classes in Guitar, Keyboard, Vocals, Tabla, Dance, Public Speaking, and Chess. Built with Next.js (App Router), Tailwind CSS, and GSAP, and deployed on Vercel.

## Running locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run lint
npm run build
```

## How demo bookings work

1. A visitor submits the "Book a Demo" form (`app/components/CTA.tsx`). Demos are free.
2. `app/api/contact/route.ts` validates the request and then:
   - sends a WhatsApp alert to the team (`app/lib/whatsapp.ts`)
   - sends a WhatsApp welcome message to the visitor
   - emails the visitor a confirmation through Resend (`app/lib/resend.ts`)
   - queues the lead in Supabase (`lead_digest_queue`)
3. Once a day, Vercel Cron calls `app/api/send-lead-digest/route.ts` (schedule in `vercel.json`). It emails `ADMIN_EMAIL` one summary of the queued leads, then clears the queue.

Every integration is optional. If its env vars are missing, that step is skipped and the booking still goes through.

## Environment variables

Set these in Vercel → Project Settings → Environment Variables.

| Variable | Used for |
| --- | --- |
| `RESEND_API_KEY` | Confirmation and digest emails (sent from `no-reply@uniedd.com`) |
| `ADMIN_EMAIL` | Where the daily lead digest goes |
| `CRON_SECRET` | Authorises the digest cron job (enable "Secure Cron Jobs" in Vercel) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Lead digest queue. Server-side only; never expose the service-role key |
| `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API sender |
| `WHATSAPP_NOTIFY_TO` | Comma-separated team numbers for lead alerts (E.164 without `+`) |
| `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG` | Team alert template (default `new_lead_alert` / `en_US`) |
| `WHATSAPP_STUDENT_TEMPLATE_NAME`, `WHATSAPP_STUDENT_TEMPLATE_LANG` | Visitor welcome template (default `student_welcome` / `en`) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL`, `KV_REST_API_TOKEN`) | Shared rate limiting (see below) |

The WhatsApp templates must be approved in Meta WhatsApp Manager. `app/lib/whatsapp.ts` documents their body variables.

## One-time setup

- Run `supabase/lead_digest_queue.sql` in the Supabase SQL editor.

## Tracking

The Meta Pixel (`app/components/MetaPixel.tsx`) loads only after a visitor accepts the cookie banner. If you add another tracker, gate it the same way and list it in the privacy policy (`app/privacy/page.tsx`).

## Rate limiting

`app/api/rate-limit.ts` keeps its counters in Upstash Redis, so the limits hold across every serverless instance. The booking form allows 5 requests per IP every 10 minutes and 2 requests per phone number per day. To set it up, add Upstash from Vercel → Storage (this sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`), or create a database at upstash.com and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Without these, or if Redis can't be reached, it falls back to a per-instance in-memory limiter that only stops simple abuse.
