import { randomUUID } from "node:crypto";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "../../../src/lib/mcp/create-server";
import {
  corsHeaders,
  corsPreflightResponse,
  withCors,
} from "../../../src/lib/mcp/cors";
import { NextJsLegacySseTransport } from "../../../src/lib/mcp/legacy-sse-transport";
import {
  getLegacySseTransports,
  getStreamableTransports,
} from "../../../src/lib/mcp/sessions";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const LEGACY_SSE_MESSAGE_ENDPOINT = "/api/mcp/messages";

function isStreamableHttpRequest(req: Request) {
  return (
    req.headers.has("mcp-session-id") ||
    req.headers.has("Mcp-Session-Id") ||
    req.method === "POST" ||
    req.method === "DELETE"
  );
}

async function handleStreamableHttp(req: Request, origin: string | null) {
  const streamableTransports = getStreamableTransports();
  const sessionId =
    req.headers.get("mcp-session-id") ??
    req.headers.get("Mcp-Session-Id") ??
    undefined;

  let transport = sessionId ? streamableTransports.get(sessionId) : undefined;

  const parsedBody =
    req.method === "POST"
      ? await req.json().catch(() => undefined)
      : undefined;

  if (
    !transport &&
    req.method === "POST" &&
    parsedBody &&
    isInitializeRequest(parsedBody)
  ) {
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        if (transport) streamableTransports.set(sid, transport);
      },
    });

    transport.onclose = () => {
      const sid = transport?.sessionId;
      if (sid) streamableTransports.delete(sid);
    };

    const server = createMcpServer();
    await server.connect(transport);
  } else if (!transport) {
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        },
        { status: 400 }
      ),
      origin
    );
  }

  const response = await transport.handleRequest(req, { parsedBody });
  return withCors(response, origin);
}

async function handleLegacySseGet(origin: string | null) {
  const legacyTransports = getLegacySseTransports();
  let transport: NextJsLegacySseTransport | undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      transport = new NextJsLegacySseTransport(
        LEGACY_SSE_MESSAGE_ENDPOINT,
        controller
      );

      transport.onclose = () => {
        legacyTransports.delete(transport!.sessionId);
      };

      legacyTransports.set(transport.sessionId, transport);

      const server = createMcpServer();
      await server.connect(transport);
    },
    cancel() {
      void transport?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      ...corsHeaders(origin),
    },
  });
}

async function handleMcpRequest(req: Request) {
  const origin = req.headers.get("origin");

  try {
    if (isStreamableHttpRequest(req)) {
      return await handleStreamableHttp(req, origin);
    }

    if (req.method === "GET") {
      return await handleLegacySseGet(origin);
    }

    return withCors(
      Response.json({ ok: false, error: "Method not allowed" }, { status: 405 }),
      origin
    );
  } catch (error) {
    console.error("[mcp]", error);
    const message =
      error instanceof Error ? error.message : "MCP request failed";
    return withCors(
      Response.json(
        {
          jsonrpc: "2.0",
          error: { code: -32603, message },
          id: null,
        },
        { status: 500 }
      ),
      origin
    );
  }
}

export async function OPTIONS(req: Request) {
  return corsPreflightResponse(req.headers.get("origin"));
}

export async function GET(req: Request) {
  return handleMcpRequest(req);
}

export async function POST(req: Request) {
  return handleMcpRequest(req);
}

export async function DELETE(req: Request) {
  return handleMcpRequest(req);
}
