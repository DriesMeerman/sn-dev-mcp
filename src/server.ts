import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    CallToolRequestSchema,
    CallToolResultSchema,
    ListToolsResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TableSchema } from "./types.js";
import { getTableSchema } from "./tools/getTableSchema.js";

// Store connection string in module scope
let serviceNowConnectionString: string | null = null;

export const server = new Server(
    {
        name: "mcp-sn",
        version: "1.0.0"
    },
    {
        capabilities: {
            // resources: {},
            tools: {},
        }
    }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async (): Promise<z.infer<typeof ListToolsResultSchema>> => {
    return {
        tools: [{
            name: "get_table_schema",
            description: "Get the schema / table definition for a servicenow table by technical name",
            inputSchema: {
                type: "object",
                properties: {
                    tableName: { type: "string" },
                },
                required: ["tableName"]
            }
        }]
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<z.infer<typeof CallToolResultSchema>> => {
    if (request.params.name === "get_table_schema") {
        if (!serviceNowConnectionString) {
            throw new Error("ServiceNow connection string not initialized. Ensure main() was called with it.");
        }
        const tableName = request.params.arguments?.tableName as string;
        if (!tableName) {
            throw new Error("Missing required argument: tableName");
        }
        // Pass the module-scoped connectionString
        const schema = await getTableSchema(tableName, serviceNowConnectionString);

        // Check if schema is null (table not found)
        if (schema === null) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Table '${tableName}' not found.`,
                    }
                ]
            };
        }

        // If schema is found, return it
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(schema, null, 2),
                }
            ]
        };
    }
    throw new Error(`Tool not found: ${request.params.name}`);
});

export async function main(connectionString: string) {
    if (!connectionString) {
        throw new Error("Connection string is required.");
    }
    // Set the module-scoped variable
    serviceNowConnectionString = connectionString;

    const transport = new StdioServerTransport();
    await server.connect(transport); // Connect doesn't take state here
    console.error("SN MCP Server running on stdio");
}