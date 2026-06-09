import {
  corsHeaders,
  corsPreflightResponse,
  withCors,
} from "../../../../src/lib/mcp/cors";
import { getLegacySseTransports } from "../../../../src/lib/mcp/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

/**
 * Legacy HTTP+SSE message endpoint (MCP protocol 2024-11-05).
 * Clients POST JSON-RPC messages here after establishing SSE on GET /api/mcp.
 */
export async function OPTIONS(req: Request) {
  return corsPreflightResponse(req.headers.get("origin"));
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return withCors(
      new Response("Missing sessionId parameter", { status: 400 }),
      origin
    );
  }

  const transport = getLegacySseTransports().get(sessionId);
  if (!transport) {
    return withCors(new Response("Session not found", { status: 404 }), origin);
  }

  try {
    const body = await req.json();
    await transport.handleMessage(body, {
      requestInfo: {
        headers: Object.fromEntries(req.headers.entries()),
        url,
      },
    });

    return new Response("Accepted", {
      status: 202,
      headers: corsHeaders(origin),
    });
  } catch (error) {
    console.error("[mcp/messages]", error);
    const message = error instanceof Error ? error.message : "Invalid message";
    return withCors(new Response(message, { status: 400 }), origin);
  }
}
