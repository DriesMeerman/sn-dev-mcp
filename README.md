# ServiceNow MCP server

This project provides a Model Context Protocol (MCP) server designed to bridge the gap between MCP-enabled development tools (like compatible IDEs and editors) and ServiceNow instances. It allows these tools to query and understand the structure of your ServiceNow environment by interacting with the ServiceNow REST API mainly calling the sys_db_object and dictionary tables.

Learn more about MCP: [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)

This project is not meant to be production ready, just a quick POC built using cursor.

## What is the Model Context Protocol (MCP)?

The Model Context Protocol (MCP) is a specification that enables development tools (editors, IDEs, AI assistants) to gain deeper contextual understanding of a user's codebase by communicating with specialized "context providers" or servers.

Instead of relying solely on static code analysis, MCP allows tools to query external systems (like databases, APIs, or custom services such as this one) through these providers. This server acts as an MCP provider specifically for ServiceNow instances.

By connecting this server to your MCP-compatible tool, you can ask questions or perform actions that require knowledge of your ServiceNow instance's configuration, such as retrieving table definitions.

# Features

*   **Get Table Schema:** Provides an MCP tool (`mcp_mcp_sn_get_table_schema`) that allows querying the schema definition for any table within your connected ServiceNow instance.
    *   It fetches the table's display label and technical name from the ServiceNow `sys_db_object` table via REST API.
    *   It retrieves detailed information for each column (field) from the `sys_dictionary` table, including:
        *   Technical field name (`element`)
        *   Display label (`column_label`)
        *   Data type (`internal_type`)
        *   Referenced table (for reference fields)
        *   Maximum length
        *   Mandatory and read-only status
        *   Description/comments
    *   Requires a connection string containing user credentials and the instance URL passed during inspector startup or configured in the client tool.

# Misc Resources

*   Official MCP Postgres Example: [https://github.com/modelcontextprotocol/servers/tree/main/src/postgres](https://github.com/modelcontextprotocol/servers/tree/main/src/postgres)
*   ServiceNow REST API Documentation: [https://developer.servicenow.com/dev.do#!/reference/api/latest/rest/c_TableAPI](https://developer.servicenow.com/dev.do#!/reference/api/latest/rest/c_TableAPI)


# Start the inspector to test
MCP Inspector Documentation: [https://modelcontextprotocol.io/docs/tools/inspector](https://modelcontextprotocol.io/docs/tools/inspector)

Build the server and run the inspector, replacing placeholders with your ServiceNow credentials and instance name:
`npm run build && npx @modelcontextprotocol/inspector node $(pwd)/dist/index.js --connection-string https://<USER>:<PASSWORD>@<INSTANCE>.service-now.com`


# Test query
Example query to use within the MCP Inspector:
```text
Can you get the definition for the servicenow incident table?
```


# MCP local configuration
Configure your MCP-compatible editor or tool to use this server. Ensure the `args` path points to the correct location of the built `index.js` file on your system.
Make sure to run `npm run build` first to create the index file.

## VScode
Admin user required due to righst needed for the accessed tables.

```json
{
    "servers": {
        "mcp-sn": {
            "command": "node",
            "args": [
                "/path/to/your/mcp-sn/dist/index.js",
                "--connection-string",
                "https://<USER>:<PASSWORD>@<INSTANCE>.service-now.com"
            ]
        }
    }
}
```

## Cursor

```json
{
    "mcpServers": {
        "mcp-sn": {
            "command": "node",
            "args": [
                "/path/to/your/mcp-sn/dist/index.js",
                "--connection-string",
                "https://<USER>:<PASSWORD>@<INSTANCE>.service-now.com"
            ]
        }
    }
}
```