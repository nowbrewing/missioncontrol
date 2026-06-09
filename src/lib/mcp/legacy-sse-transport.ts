import { randomUUID } from "node:crypto";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  JSONRPCMessageSchema,
  type JSONRPCMessage,
  type MessageExtraInfo,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Next.js-compatible legacy HTTP+SSE transport (MCP protocol 2024-11-05).
 * Writes SSE events to a Web ReadableStream controller.
 */
export class NextJsLegacySseTransport implements Transport {
  readonly sessionId: string;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  private controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  private closed = false;
  private readonly encoder = new TextEncoder();

  constructor(
    private readonly postEndpoint: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ) {
    this.sessionId = randomUUID();
    this.controller = controller;
  }

  async start(): Promise<void> {
    const endpoint = `${this.postEndpoint}?sessionId=${encodeURIComponent(this.sessionId)}`;
    this.writeSseEvent("endpoint", endpoint);
  }

  async send(message: JSONRPCMessage): Promise<void> {
    this.writeSseEvent("message", JSON.stringify(message));
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    try {
      this.controller?.close();
    } catch {
      // Stream may already be closed.
    }
    this.controller = null;
    this.onclose?.();
  }

  async handleMessage(
    message: unknown,
    extra?: MessageExtraInfo
  ): Promise<void> {
    const parsed = JSONRPCMessageSchema.parse(message);
    this.onmessage?.(parsed, extra);
  }

  private writeSseEvent(event: string, data: string) {
    if (!this.controller) {
      throw new Error("SSE stream is not open");
    }
    const payload = `event: ${event}\ndata: ${data}\n\n`;
    this.controller.enqueue(this.encoder.encode(payload));
  }
}
