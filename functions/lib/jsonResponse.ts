/**
 * Helpers for Pages Functions to GUARANTEE that every response is
 * application/json — never HTML, never an unhandled exception that
 * Cloudflare turns into a default error page.
 *
 * Why this matters: if a Function throws or if the request method does not
 * match an exported method-specific handler (e.g. onRequestPost only), Pages
 * falls back to serving the static SPA index.html. Mobile clients that expect
 * JSON then see a parser failure. Routing every entry point through
 * `withJsonGuard` removes both failure modes.
 */

export type JsonHeaders = Record<string, string>;

const BASE_JSON_HEADERS: JsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders: JsonHeaders = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...BASE_JSON_HEADERS, ...extraHeaders },
  });
}

export function methodNotAllowed(method: string, allowed: string[] = ['POST']): Response {
  return jsonResponse(
    {
      success: false,
      error: `Method ${method} not allowed. Use ${allowed.join(', ')}.`,
    },
    405,
    { Allow: allowed.join(', ') }
  );
}

export function logRequestDiag(label: string, request: Request): void {
  // CF-IPCountry / CF-Connecting-IP are set by Cloudflare on the inbound request.
  const method = request.method;
  const ua = request.headers.get('user-agent') || '';
  const country = request.headers.get('cf-ipcountry') || '';
  const ip = request.headers.get('cf-connecting-ip') || '';
  const accept = request.headers.get('accept') || '';
  const ct = request.headers.get('content-type') || '';
  console.log(
    `[${label}] method=${method} country=${country} ip=${ip} ct="${ct}" accept="${accept}" ua="${ua}"`
  );
}

/**
 * Wraps a per-method handler so any thrown error is caught and returned as
 * JSON 500 instead of letting Pages serve the default HTML error page.
 */
export async function withJsonGuard(
  label: string,
  request: Request,
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    logRequestDiag(label, request);
    return await handler();
  } catch (err: any) {
    const message = err?.message || 'unknown error';
    console.error(`[${label}] unhandled exception: ${message}`, err);
    return jsonResponse(
      { success: false, error: `Server error: ${message}` },
      500
    );
  }
}
