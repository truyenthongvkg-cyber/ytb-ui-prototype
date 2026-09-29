import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const WIDGET_URI = "ui://ytb-followup-test/widget-v1.html";
const widgetHtml = readFileSync(new URL("./public/widget.html", import.meta.url), "utf8");

function createMcpServer() {
  const server = new McpServer({
    name: "ytb-followup-test",
    version: "0.2.0",
  });

  registerAppResource(
    server,
    "ytb-followup-widget",
    WIDGET_URI,
    {},
    async () => ({
      contents: [
        {
          uri: WIDGET_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: { prefersBorder: true },
            "openai/ui": { availableDisplayModes: ["inline"] },
          },
        },
      ],
    })
  );

  registerAppTool(
    server,
    "show_ytb_followup_test",
    {
      title: "Show YTB metadata copy test",
      description:
        "Render a YTB metadata widget with four separate fields and real copy buttons. This prototype tests metadata persistence and copy behavior only.",
      inputSchema: {
        title: z.string().optional(),
        description: z.string().optional(),
        hashtags: z.string().optional(),
        tags: z.string().optional(),
      },
      outputSchema: {
        title: z.string(),
        description: z.string(),
        hashtags: z.string(),
        tags: z.string(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
        idempotentHint: true,
      },
      _meta: {
        ui: { resourceUri: WIDGET_URI },
        "openai/outputTemplate": WIDGET_URI,
      },
    },
    async ({ title, description, hashtags, tags }) => ({
      structuredContent: {
        title: title?.trim() || "10 True Crime Cases That Shocked America",
        description:
          description?.trim() ||
          "This documentary examines ten major true crime cases from across the United States, focusing on verified case backgrounds, investigations, court records, and the lasting impact on the communities involved.",
        hashtags:
          hashtags?.trim() ||
          "#TrueCrime #CrimeDocumentary #AmericanCrime #CriminalCases #Documentary",
        tags:
          tags?.trim() ||
          "true crime, crime documentary, American crime, criminal cases, case files, true crime documentary, crime stories, criminal investigation, documentary, US crime",
      },
      content: [
        {
          type: "text",
          text: "Rendered the YTB metadata copy prototype.",
        },
      ],
    })
  );

  return server;
}

const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname !== MCP_PATH) {
    res.writeHead(404).end("Not found");
    return;
  }

  const mcpServer = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on("close", () => {
    transport.close().catch(() => {});
    mcpServer.close().catch(() => {});
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500);
    res.end("Internal server error");
  }
});

httpServer.listen(port, () => {
  console.log(`YTB UI prototype listening on http://localhost:${port}${MCP_PATH}`);
});
