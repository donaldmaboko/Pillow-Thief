# Pillow Thief — Supabase Edge Functions

| Function | Purpose | Auth |
| --- | --- | --- |
| `booking-quote` | Server-side price + travel fee quote (Routes API). Never trusts client prices. | public (read-only computation) |
| `booking-create` | Creates booking + payment intent; DB-side re-validation & conflict guard. | user JWT |
| `payment-webhook` | The ONLY path that captures payments and advances booking status. Signature-verified, idempotent. | gateway signature |
| `sandbox-gateway` | DEV-ONLY simulated gateway that emits signed webhooks. Disabled unless `PAYMENT_PROVIDER=sandbox`. | n/a |
| `booking-actions` | Provider accept/decline (auto full refund) and client cancel (policy refund). | user JWT |
| `admin-verification` | Approve/reject provider applications; suspend/reinstate providers. | admin JWT |
| `payouts-run` | Aggregates completed bookings into payout records for a period. | admin JWT |
| `push-notify` | Sends Expo push notifications for pending in-app notifications. | service_role |
| `account-delete` | Account deletion workflow. | user JWT |

## Required secrets

Set per-function (or project-wide) with `supabase secrets set`:

```
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY  # injected automatically
SANDBOX_WEBHOOK_SECRET=<random 32+ chars>   # signs simulated payment webhooks
PAYMENT_PROVIDER=sandbox                     # or a live adapter name once wired
GOOGLE_MAPS_SERVER_KEY=<server-restricted key>  # Routes/Places/Geocoding (server side)
EXPO_ACCESS_TOKEN=<expo push token>          # optional, for push receipts
```

## Local development

```bash
supabase start
supabase functions serve --import-map functions/deno.json --env-file .env.local
```

Deploy:

```bash
supabase functions deploy booking-quote
supabase functions deploy booking-create
# ... etc
```
