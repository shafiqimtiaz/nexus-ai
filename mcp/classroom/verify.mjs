// Proof-of-life for the Classroom MCP server + in-memory client bridge.
// Runs the real MCP plumbing (server construction, linked in-memory transport,
// client connect, listTools) WITHOUT any Google credentials — it only lists the
// registered tools, it never calls them. Requires Node >= 22.18 (native TS).
//
// Run: node mcp/classroom/verify.mjs

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createClassroomMcpServer } from "./server.ts";

const EXPECTED = [
  "list_announcements",
  "list_assignments",
  "list_materials",
  "get_class_info",
];

const server = createClassroomMcpServer();
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

const client = new Client({ name: "nexus-verify", version: "1.0.0" });

await Promise.all([
  server.connect(serverTransport),
  client.connect(clientTransport),
]);

const { tools } = await client.listTools();

console.log(`\nMCP server connected. Tools registered: ${tools.length}\n`);
for (const t of tools) {
  console.log(`  - ${t.name}: ${t.description}`);
}

const names = tools.map((t) => t.name).sort();
const ok =
  names.length === EXPECTED.length &&
  EXPECTED.every((n) => names.includes(n));

console.log(`\nExpected 4 tools present: ${ok ? "YES" : "NO"}`);

await client.close();
await server.close();

if (!ok) process.exit(1);
