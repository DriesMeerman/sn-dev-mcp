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
import { findRelevantScripts } from "./tools/findRelevantScripts.js";
import { findSystemProperties } from "./tools/findSystemProperties.js";
import { findBusinessRules } from "./tools/getBusinessRuleDetails.js";
import { initializeService } from "./services/serviceNowService.js";
import { getAclDetails } from "./tools/getAclDetails.js";

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
            },
            {
                name: "find_relevant_scripts",
                description:
                    "Searches for existing scripts (Business Rules, Script Includes, Client Scripts) potentially relevant based on table name, keywords, or scope. Helps discover existing logic. At least one of tableName, keywords, or scopeName must be provided.",
                inputSchema: {
                    type: "object",
                    properties: {
                        tableName: {
                            type: "string",
                            description: "Optional. The technical name of the table (e.g., 'incident').",
                        },
                        keywords: {
                            type: "string",
                            description: "Optional. Keywords to search in script names or content.",
                        },
                        scriptType: {
                            type: "string",
                            description:
                                "Optional. Filter by script type (e.g., 'Business Rule', 'Script Include', 'Client Script').",
                        },
                        scopeName: {
                            type: "string",
                            description:
                                "Optional. The name or label of the application scope to filter by (e.g., 'Global', 'My Custom App').",
                        },
                    },
                },
            },
            {
                name: "find_system_properties",
                description: "Searches system properties (sys_properties) by exact name OR wildcard in description. Returns name, value, description, scope, and last updated date.",
                inputSchema: {
                    type: "object",
                    properties: {
                        searchTerm: {
                            type: "string",
                            description: "The exact property name or a term to search for (wildcard supported) in the description."
                        }
                    },
                    required: ["searchTerm"]
                }
            },
            {
                name: "get_business_rule_details",
                description: "Retrieves metadata for Business Rules matching a specific name or table (e.g., trigger conditions, order, active status, conditions). Returns rules ordered by execution order when searching by table. At least one of businessRuleName or tableName must be provided.",
                inputSchema: {
                    type: "object",
                    properties: {
                        businessRuleName: {
                            type: "string",
                            description: "Optional. The exact name of the Business Rule."
                        },
                        tableName: {
                            type: "string",
                            description: "Optional. The table the Business Rule runs on."
                        }
                    },
                }
            },
            {
                name: "get_acl_details",
                description: "Retrieves details for Access Control List (ACL) records matching the specified criteria (name/table, operation, type). Helps understand permissions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        aclNameOrTable: {
                            type: "string",
                            description: "The specific name of the ACL (e.g., 'incident.number') or the table name (e.g., 'incident') to find related ACLs."
                        },
                        operation: {
                            type: "string",
                            description: "Optional. Filter by operation (e.g., 'read', 'write', 'create', 'delete')."
                        },
                        type: {
                            type: "string",
                            description: "Optional. Filter by type (e.g., 'record', 'field')."
                        }
                    },
                    required: ["aclNameOrTable"]
                }
            }
        ]
    };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request): Promise<z.infer<typeof CallToolResultSchema>> => {
    const toolName = request.params.name;
    const args = request.params.arguments;

    if (toolName === "get_table_schema") {
        const tableName = args?.tableName as string;
        if (!tableName) {
            throw new Error("Missing required argument: tableName for get_table_schema");
        }
        const schema: TableSchema | null = await getTableSchema(tableName);

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
    } else if (toolName === "get_field_choices") {
        const tableName = args?.tableName as string;
        const fieldName = args?.fieldName as string;

        if (!tableName || !fieldName) {
            throw new Error("Missing required arguments: tableName and fieldName for get_field_choices");
        }

        const choices: FieldChoice[] | null = await getFieldChoices(tableName, fieldName);

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
    } else if (toolName === "get_script_include_api") {
        const scriptIncludeName = args?.scriptIncludeName as string;

        if (!scriptIncludeName) {
            throw new Error("Missing required argument: scriptIncludeName for get_script_include_api");
        }

        // Call the tool function
        const result = await getScriptIncludeApi(scriptIncludeName);

        // Format the result
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                }
            ]
        };
    } else if (toolName === "find_relevant_scripts") {
        // Extract arguments
        const tableName = args?.tableName as string | undefined;
        const keywords = args?.keywords as string | undefined;
        const scriptType = args?.scriptType as string | undefined;
        const scopeName = args?.scopeName as string | undefined;

        // Validate: At least one criteria must be provided
        if (!tableName && !keywords && !scopeName) {
            throw new Error("Missing required arguments: At least one of tableName, keywords, or scopeName must be provided for find_relevant_scripts");
        }

        // Call the implementation function
        const results = await findRelevantScripts({
                tableName,
                keywords,
                scriptType,
                scopeName
            });

        // Format and return results
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(results, null, 2)
                }
            ]
        };
    } else if (toolName === "find_system_properties") {
        const searchTerm = args?.searchTerm as string;
        if (!searchTerm) {
            throw new Error("Missing required argument: searchTerm for find_system_properties");
        }
        const results = await findSystemProperties(searchTerm);
        if (results && results.length > 0) {
            return { content: [ { type: "text", text: JSON.stringify(results, null, 2) } ] };
        } else {
            return { content: [ { type: "text", text: `No system properties found matching '${searchTerm}'.` } ] };
        }
    } else if (toolName === "get_business_rule_details") {
        const businessRuleName = args?.businessRuleName as string | undefined;
        const tableName = args?.tableName as string | undefined;

        // Input validation (delegated to the findBusinessRules function now)
        // if (!businessRuleName && !tableName) {
        //     throw new Error("Missing required argument: businessRuleName or tableName for get_business_rule_details");
        // }

        try {
            // Call the renamed implementation function
            const results = await findBusinessRules({ businessRuleName, tableName });

            if (results && results.length > 0) {
                // Format and return the array of details
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(results, null, 2)
                        }
                    ]
                };
            } else {
                // No rules found
                let message = `No Business Rules found`;
                if (businessRuleName) message += ` matching name '${businessRuleName}'`;
                if (tableName) message += ` for table '${tableName}'`;
                message += '.';
                return {
                    content: [
                        {
                            type: "text",
                            text: message
                        }
                    ]
                };
            }
        } catch (error: any) {
            // Handle specific ambiguity error or other errors from the tool function
             return {
                content: [
                    {
                        type: "text",
                        text: `Error finding Business Rule(s): ${error.message}`
                    }
                ]
            };
        }
    } else if (toolName === "get_acl_details") {
        const aclNameOrTable = args?.aclNameOrTable as string;
        const operation = args?.operation as string | undefined;
        const type = args?.type as string | undefined;

        if (!aclNameOrTable) {
            throw new Error("Missing required argument: aclNameOrTable for get_acl_details");
        }

        try {
            // Call the implementation function
            const results = await getAclDetails({ aclNameOrTable, operation, type });

            if (results && results.length > 0) {
                // Format and return the array of details
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(results, null, 2)
                        }
                    ]
                };
            } else {
                // No ACLs found
                let message = `No ACLs found matching criteria: name/table='${aclNameOrTable}'`;
                if (operation) message += `, operation='${operation}'`;
                if (type) message += `, type='${type}'`;
                message += '.';
                return {
                    content: [
                        {
                            type: "text",
                            text: message
                        }
                    ]
                };
            }
        } catch (error: any) {
            // Handle errors from the tool function
             return {
                content: [
                    {
                        type: "text",
                        text: `Error finding ACL(s): ${error.message}`
                    }
                ]
            };
        }
    }

    // If tool name doesn't match known tools
    throw new Error(`Tool not found: ${toolName}`);
});

export async function main(connectionString: string) {
    if (!connectionString) {
        throw new Error("Connection string is required for server startup.");
    }
    try {
        initializeService(connectionString);
        // Comment out success log
        // console.error("ServiceNowService initialized successfully.");
    } catch (error: any) {
        // Comment out fatal error log (though maybe keep this one? Depends on desired behavior)
        // console.error("FATAL: Failed to initialize ServiceNowService:", error.message);
        process.exit(1);
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    // Comment out server running log
    // console.error("SN MCP Server running on stdio");
}