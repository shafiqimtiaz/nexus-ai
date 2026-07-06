import "server-only";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { tool, jsonSchema, type Tool } from "ai";
import { createClassroomMcpServer } from "../../../mcp/classroom/server";

// Bridge between the in-repo MCP server and the Vercel AI SDK. The AI SDK has no
// native MCP support, so we spin up the MCP server in-process, connect a client
// over a linked in-memory transport, and wrap each MCP tool as an AI SDK tool
// whose `execute` proxies back through the MCP client. The result is a plain
// map ready to spread into `streamText({ tools })`.

type JsonSchemaInput = Parameters<typeof jsonSchema>[0];

// Pull the joined text out of an MCP tool result.
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("\n");
}

export async function getClassroomTools(): Promise<Record<string, Tool>> {
  const server = createClassroomMcpServer();
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  const client = new Client({
    name: "nexus-classroom-client",
    version: "1.0.0",
  });

  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const { tools: mcpTools } = await client.listTools();

  const tools: Record<string, Tool> = {};

  for (const mcpTool of mcpTools) {
    tools[mcpTool.name] = tool({
      description: mcpTool.description,
      inputSchema: jsonSchema(mcpTool.inputSchema as JsonSchemaInput),
      execute: async (args) => {
        const result = await client.callTool({
          name: mcpTool.name,
          arguments: (args ?? {}) as Record<string, unknown>,
        });

        const text = extractText(
          result.content as Array<{ type: string; text?: string }>
        );

        // MCP surfaces tool-side failures (e.g. "Classroom not connected") as
        // isError results rather than transport errors — turn them back into a
        // thrown error so the caller/model sees the failure.
        if (result.isError) {
          throw new Error(text || "Classroom tool call failed.");
        }

        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      },
    });
  }

  return tools;
}
