import type { StreamableHTTPConnectionParams } from "@google/adk";

const DEFAULT_MCP_URL = "http://localhost:3000/api/mcp";

export function getMissionControlMcpUrl(): string {
  const explicit = process.env.MISSION_CONTROL_MCP_URL?.trim();
  if (explicit) return explicit;

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}/api/mcp`;

  return DEFAULT_MCP_URL;
}

export function getMissionControlMcpConnectionParams(): StreamableHTTPConnectionParams {
  return {
    type: "StreamableHTTPConnectionParams",
    url: getMissionControlMcpUrl(),
  };
}
