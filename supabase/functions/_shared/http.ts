// Shared CORS + HTTP helpers for Pillow Thief Edge Functions.
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function error(code: string, message: string, status = 400): Response {
  return json({ error: { code, message } }, status)
}

export function optionsResponse(): Response {
  return new Response('ok', { headers: corsHeaders })
}

/**
 * Parse and return the JSON body, or throw a friendly error.
 * Also returns the raw text for webhook signature verification.
 */
export async function readJsonBody(req: Request): Promise<{ raw: string; data: unknown }> {
  const raw = await req.text()
  try {
    return { raw, data: raw ? JSON.parse(raw) : {} }
  } catch {
    throw new Error('invalid_json')
  }
}
