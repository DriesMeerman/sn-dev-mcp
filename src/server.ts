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
import { TableSchema, FieldChoice } from "./types.js";
import { getTableSchema } from "./tools/getTableSchema.js";
import { getFieldChoices } from "./tools/getFieldChoices.js";
import { getScriptIncludeApi } from "./tools/getScriptIncludeApi.js";

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
        tools: [
            {
                name: "get_table_schema",
                description: "Get the schema / table definition for a ServiceNow table by its technical name (e.g., 'incident').",
                inputSchema: {
                    type: "object",
                    properties: {
                        tableName: { type: "string", description: "The technical name of the ServiceNow table." },
                    },
                    required: ["tableName"]
                }
            },
            {
                name: "get_field_choices",
                description: "Get the available choices for a specific field on a ServiceNow table. Useful for fields of type 'choice' or integer fields representing states (e.g., incident state).",
                inputSchema: {
                    type: "object",
                    properties: {
                        tableName: { type: "string", description: "The technical name of the ServiceNow table (e.g., 'incident')." },
                        fieldName: { type: "string", description: "The technical name of the field (element) on the table (e.g., 'state')." },
                    },
                    required: ["tableName", "fieldName"]
                }
            },
            {
                name: "get_script_include_api",
                description: "Retrieves the public API methods (function names, parameters, and JSDoc comments if available) for a specific Script Include. Helps understand how to call server-side reusable code.",
                inputSchema: {
                    type: "object",
                    properties: {
                        scriptIncludeName: {
                            type: "string",
                            description: "The name of the Script Include (e.g., 'IncidentUtils')."
                        }
                    },
                    required: ["scriptIncludeName"]
                }
            }
        ]
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<z.infer<typeof CallToolResultSchema>> => {
    if (!serviceNowConnectionString) {
        throw new Error("ServiceNow connection string not initialized. Ensure main() was called with it.");
    }

    if (request.params.name === "get_table_schema") {
        const tableName = request.params.arguments?.tableName as string;
        if (!tableName) {
            throw new Error("Missing required argument: tableName for get_table_schema");
        }
        const schema: TableSchema | null = await getTableSchema(tableName, serviceNowConnectionString);

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

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(schema, null, 2),
                }
            ]
        };
    } else if (request.params.name === "get_field_choices") {
        const tableName = request.params.arguments?.tableName as string;
        const fieldName = request.params.arguments?.fieldName as string;

        if (!tableName || !fieldName) {
            throw new Error("Missing required arguments: tableName and fieldName for get_field_choices");
        }

        const choices: FieldChoice[] | null = await getFieldChoices(tableName, fieldName, serviceNowConnectionString);

        if (choices === null) {
            // Error occurred during fetching
            return {
                content: [
                    {
                        type: "text",
                        text: `Error fetching choices for field '${fieldName}' on table '${tableName}'. Check server logs for details.`,
                    }
                ]
            };
        } else if (choices.length === 0) {
            // No choices found
            return {
                content: [
                    {
                        type: "text",
                        text: `No active choices found for field '${fieldName}' on table '${tableName}'.`,
                    }
                ]
            };
        }

        // Choices found

        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(choices, null, 2),
                }
            ]
        };
    } else if (request.params.name === "get_script_include_api") {
        const scriptIncludeName = request.params.arguments?.scriptIncludeName as string;

        if (!scriptIncludeName) {
            throw new Error("Missing required argument: scriptIncludeName for get_script_include_api");
        }

        // Call the tool function
        const result = await getScriptIncludeApi(scriptIncludeName, serviceNowConnectionString);

        // Format the result
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                }
            ]
        };
    }

    // If tool name doesn't match known tools
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