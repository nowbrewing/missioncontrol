import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { NextJsLegacySseTransport } from "./legacy-sse-transport";

const globalForMcp = globalThis as typeof globalThis & {
  _mcpStreamableTransports?: Map<string, WebStandardStreamableHTTPServerTransport>;
  _mcpLegacySseTransports?: Map<string, NextJsLegacySseTransport>;
};

export function getStreamableTransports() {
  if (!globalForMcp._mcpStreamableTransports) {
    globalForMcp._mcpStreamableTransports = new Map();
  }
  return globalForMcp._mcpStreamableTransports;
}

export function getLegacySseTransports() {
  if (!globalForMcp._mcpLegacySseTransports) {
    globalForMcp._mcpLegacySseTransports = new Map();
  }
  return globalForMcp._mcpLegacySseTransports;
}
