import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Builds the in-repo MCP server that exposes read-only Google Classroom tools.
// The handlers lazily import ./tools (which is server-only and touches Supabase)
// so the server can be constructed and its tools listed without any Google
// credentials — the actual Classroom logic only loads when a tool is called.
export function createClassroomMcpServer(): McpServer {
  const server = new McpServer({
    name: "nexus-classroom",
    version: "1.0.0",
  });

  const limitShape = {
    limit: z
      .number()
      .int()
      .positive()
      .max(50)
      .optional()
      .describe("Maximum number of items to return (default 10)."),
  };

  const asText = (result: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(result) }],
  });

  server.registerTool(
    "list_announcements",
    {
      title: "List announcements",
      description:
        "List recent announcements posted in the connected Google Classroom course. Returns id, text, creation time, and a link for each.",
      inputSchema: limitShape,
    },
    async ({ limit }) => {
      const { listAnnouncements } = await import("./tools");
      return asText(await listAnnouncements(limit));
    }
  );

  server.registerTool(
    "list_assignments",
    {
      title: "List assignments",
      description:
        "List assignments (course work) in the connected Google Classroom course. Returns id, title, description, ISO due date (or null), and a link for each. Use this to answer questions about what is due and when.",
      inputSchema: limitShape,
    },
    async ({ limit }) => {
      const { listAssignments } = await import("./tools");
      return asText(await listAssignments(limit));
    }
  );

  server.registerTool(
    "list_materials",
    {
      title: "List materials",
      description:
        "List course materials (readings, references, resources) in the connected Google Classroom course. Returns id, title, description, and a link for each.",
      inputSchema: limitShape,
    },
    async ({ limit }) => {
      const { listMaterials } = await import("./tools");
      return asText(await listMaterials(limit));
    }
  );

  server.registerTool(
    "get_class_info",
    {
      title: "Get class info",
      description:
        "Get basic details about the connected Google Classroom course: id, name, section, and room.",
    },
    async () => {
      const { getClassInfo } = await import("./tools");
      return asText(await getClassInfo());
    }
  );

  return server;
}
