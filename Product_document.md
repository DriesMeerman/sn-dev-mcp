**Product Requirements Document: ServiceNow MCP Server (POC)**

*   **Version:** 0.2
*   **Status:** Draft
*   **Date:** 2023-10-27
*   **Author:** [Your Name/Team]
*   **Stakeholders:** Developers using MCP-enabled tools, ServiceNow Platform Owners (for instance access)

**1. Introduction**

This document outlines the requirements for a Proof of Concept (POC) implementation of a Model Context Protocol (MCP) server specifically designed for ServiceNow. This server acts as an intermediary, connecting MCP-enabled development tools (like compatible IDEs, editors, or chat interfaces) with a target ServiceNow instance via its REST API. The primary goal is to provide contextual information about the ServiceNow environment to Large Language Models (LLMs), enabling them to generate more accurate, relevant, and instance-aware ServiceNow code (e.g., Server-side scripts, Client Scripts, API usage) and, with extreme caution, test snippets.

This project is explicitly a POC, intended to validate the approach and demonstrate value, not for production deployment without significant further development. **The inclusion of a direct script execution feature (`execute_script`) carries significant risk and must be treated with extreme caution, intended only for non-production environments and requiring explicit user confirmation steps within the client tool.**

**Learn more about MCP:** [https://modelcontextprotocol.io/](https://modelcontextprotocol.io/)

**2. Goals**

*   **Validate MCP for ServiceNow:** Demonstrate the feasibility of using MCP to expose ServiceNow instance context and limited execution capabilities.
*   **Provide Essential Context:** Offer foundational tools for LLMs to understand ServiceNow table structures, choices, permissions, and common scripting objects.
*   **Improve LLM Code Generation:** Enable LLMs to generate more accurate ServiceNow code snippets by providing instance-specific details.
*   **Enable Cautious Testing:** Provide a mechanism (with safeguards) for developers to quickly test generated code snippets in a controlled, non-production environment via the MCP interface.
*   **Establish Foundation:** Create a basic server structure that can be expanded with more tools in the future.
*   **Developer Experience:** Offer a way for developers using MCP tools to query and interact with their specific ServiceNow instance context without leaving their development environment.

**3. Target Audience**

*   **ServiceNow Developers:** Developers writing server-side and client-side scripts within ServiceNow.
*   **Users of MCP-enabled Tools:** Developers using IDEs, editors (like Cursor), or other tools supporting MCP for LLM interaction, *who understand the risks associated with direct script execution*.

**4. Requirements**

| Req ID  | Feature/Requirement           | Description                                                                                                                                                                                                                            | Priority (POC) | MCP Tool (If Applicable) |
| :------ | :---------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------- | :----------------------- |
| **Core Server Functionality** |                               |                                                                                                                                                                                                                        |                |                          |
| CORE-01 | MCP Compliance                | Implement an HTTP server adhering to basic MCP specifications for tool discovery (`/tools`) and execution.                                                                                                                             | High           | N/A                      |
| CORE-02 | ServiceNow Connection         | Connect to a specified ServiceNow instance via REST API using configurable credentials and URL.                                                                                                                                        | High           | N/A                      |
| CORE-03 | Secure Authentication         | Support Basic Authentication (user/pass) for connecting to ServiceNow. Credentials must be configurable (env vars/config file), not hardcoded.                                                                                         | High           | N/A                      |
| CORE-04 | Request Handling              | Receive MCP tool execution requests, validate against schemas, translate to ServiceNow API calls.                                                                                                                                      | High           | N/A                      |
| CORE-05 | Response Formatting           | Process ServiceNow API responses and format results into the JSON structure expected by MCP clients.                                                                                                                                   | High           | N/A                      |
| CORE-06 | Error Handling                | Provide informative MCP-compliant error messages for invalid requests, ServiceNow API failures, or missing data.                                                                                                                       | High           | N/A                      |
| **MCP Tools** |                               |                                                                                                                                                                                                                        |                |                          |
| TOOL-01 | Get Table Schema              | Provide field names, types, labels, reference info, etc., for a given ServiceNow table.                                                                                                                                                | High           | `get_table_schema`       |
| TOOL-02 | Get Field Choices             | Provide the list of available choices (value/label pairs) for a choice/state field on a table.                                                                                                                                        | High           | `get_field_choices`      |
| TOOL-03 | Get Script Include API        | Retrieve public function names/signatures (and potentially JSDoc comments) for a specified Script Include. Requires parsing script content.                                                                                            | Medium         | `get_script_include_api` |
| TOOL-04 | Find Relevant Scripts         | Search for existing Business Rules, Script Includes, Client Scripts based on table name or keywords.                                                                                                                                  | Medium         | `find_relevant_scripts`  |
| TOOL-05 | Get System Property Value     | Retrieve the value and description of a specified system property (`sys_properties`).                                                                                                                                                  | Medium         | `get_system_property_value` |
| TOOL-06 | Get Business Rule Details     | Retrieve details (table, trigger conditions, order, active, conditions, script) for a specific Business Rule.                                                                                                                            | Medium         | `get_business_rule_details` |
| TOOL-07 | Get ACL Details               | Retrieve details (name, type, operation, active status, roles, condition script) for Access Controls (ACLs) matching specified criteria.                                                                                                | Medium         | `get_acl_details`        |
| TOOL-08 | Execute Script ("YOLO Mode")  | **(HIGH RISK)** Execute a provided GlideScript code snippet via ServiceNow's Background Scripts functionality. **Requires client-side double explicit confirmation.** Intended for non-production instances ONLY.                       | Medium         | `execute_script`         |
| **Non-Functional Requirements** |                               |                                                                                                                                                                                                                        |                |                          |
| NFR-01  | Security (Credentials)        | ServiceNow credentials must be stored securely (e.g., env vars). HTTPS must be used for ServiceNow communication.                                                                                                                      | High           | N/A                      |
| NFR-02  | Security (YOLO Mode)        | **CRITICAL:** The `execute_script` tool introduces significant security risks. It MUST: <br/> a) Be disable-able via server configuration. <br/> b) Log all execution requests prominently. <br/> c) **Rely on the MCP client tool to implement DOUBLE EXPLICIT user confirmation before sending the request.** <br/> d) Be clearly documented as dangerous and for non-production use only. | High           | `execute_script`         |
| NFR-03  | Performance                   | Response times for read operations should be reasonable for interactive use (target < 5s). No complex caching or optimization required for POC.                                                                                     | Medium         | N/A                      |
| NFR-04  | Configuration                 | ServiceNow instance URL and credentials must be easily configurable. Configuration for enabling/disabling `execute_script` must exist.                                                                                             | High           | N/A                      |
| NFR-05  | Reliability                   | Handle basic API errors gracefully. High availability not required for POC.                                                                                                                                                            | Medium         | N/A                      |
| NFR-06  | Maintainability               | Code should be reasonably structured/commented for a POC.                                                                                                                                                                            | Medium         | N/A                      |

**5. MCP Tool Details**

*(Includes existing, added, and modified tool definitions)*

*   **`get_table_schema`**
    *   **Description:** Get the schema / table definition for a ServiceNow table by its technical name (e.g., 'incident'). Provides field names, types, labels, reference info, max length etc.
    *   **Input Schema:** (Same as before)
        ```json
        { "type": "object", "properties": { "tableName": { "type": "string", "description": "The technical name of the ServiceNow table." } }, "required": ["tableName"] }
        ```
    *   **Use Case:** Helps LLM understand available fields for GlideRecord queries, form manipulations.

*   **`get_field_choices`**
    *   **Description:** Get the available choices for a specific field on a ServiceNow table. Useful for fields of type 'choice' or integer fields representing states.
    *   **Input Schema:** (Same as before)
        ```json
        { "type": "object", "properties": { "tableName": { "type": "string", "description": "The technical name of the ServiceNow table (e.g., 'incident')." }, "fieldName": { "type": "string", "description": "The technical name of the field (element) on the table (e.g., 'state')." } }, "required": ["tableName", "fieldName"] }
        ```
    *   **Use Case:** Ensures LLM uses correct values when setting choice fields or checking states.

*   **`get_script_include_api`**
    *   **Description:** Retrieves the public API methods (function names and potentially JSDoc comments if available) for a specific Script Include. Helps understand how to call server-side reusable code. *Note: Relies on parsing script content, may be fragile.*
    *   **Input Schema:**
        ```json
        { "type": "object", "properties": { "scriptIncludeName": { "type": "string", "description": "The name of the Script Include (e.g., 'IncidentUtils')." } }, "required": ["scriptIncludeName"] }
        ```
    *   **Use Case:** Enables LLM to correctly instantiate and call methods from Script Includes.

*   **`find_relevant_scripts`**
    *   **Description:** Searches for existing scripts (Business Rules, Script Includes, Client Scripts) potentially relevant based on table name, keywords, or scope. Helps discover existing logic.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "tableName": {
              "type": "string",
              "description": "Optional. The technical name of the table (e.g., 'incident')."
            },
            "keywords": {
              "type": "string",
              "description": "Optional. Keywords to search in script names or content."
            },
            "scriptType": {
              "type": "string",
              "description": "Optional. Filter by script type (e.g., 'Business Rule', 'Script Include', 'Client Script')."
            },
            "scopeName": {
              "type": "string",
              "description": "Optional. The name of the application scope to filter by (e.g., 'Global', 'My Custom App')."
            }
          },
          "anyOf": [
            { "required": ["tableName"] },
            { "required": ["keywords"] },
            { "required": ["scopeName"] }
          ]
        }
        ```
    *   **Use Case:** Helps LLM find existing code patterns within a specific scope, avoid duplication.

*   **`get_system_property_value`**
    *   **Description:** Retrieves the value of a specific system property (`sys_properties`).
    *   **Input Schema:**
        ```json
        { "type": "object", "properties": { "propertyName": { "type": "string", "description": "The exact name of the system property." } }, "required": ["propertyName"] }
        ```
    *   **Use Case:** Allows LLM to generate code using instance-specific configurations.

*   **`get_business_rule_details`**
    *   **Description:** Retrieves key details about a specific Business Rule (table, trigger conditions, order, active status, conditions, script).
    *   **Input Schema:**
        ```json
        { "type": "object", "properties": { "businessRuleName": { "type": "string", "description": "The name of the Business Rule." }, "tableName": { "type": "string", "description": "Optional. The table the Business Rule runs on (helps disambiguate)." } }, "required": ["businessRuleName"] }
        ```
    *   **Use Case:** Helps LLM understand existing automation on a table.

*   **`get_acl_details`** *(New)*
    *   **Description:** Retrieves details for Access Control List (ACL) records matching the specified criteria. Helps understand permissions for tables and fields.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "aclNameOrTable": { "type": "string", "description": "The specific name of the ACL (e.g., 'incident.number') or the table name (e.g., 'incident') to find related ACLs." },
            "operation": { "type": "string", "description": "Optional. Filter by operation (e.g., 'read', 'write', 'create', 'delete')." },
            "type": { "type": "string", "description": "Optional. Filter by type (e.g., 'record', 'field')." }
          },
          "required": ["aclNameOrTable"]
        }
        ```
    *   **Output (Conceptual):** A JSON array of ACL objects, each containing `name`, `type`, `operation`, `admin_overrides`, `active`, required `roles` (list), `condition` script (string), `description`. (Leverages queries against `sys_security_acl` table).
    *   **Use Case:** Enables LLM to understand *who* can do *what* to specific records/fields, crucial for generating secure code or explaining access issues.

*   **`execute_script` ("YOLO Mode")** *(New - High Risk)*
    *   **Description:** **(HIGH RISK - USE WITH EXTREME CAUTION)** Executes the provided server-side GlideScript code snippet using the ServiceNow Background Scripts feature. This directly runs code on the instance and can have significant side effects (data modification, performance impact, errors). **This tool MUST NOT be used on production instances.** The calling MCP client tool (IDE/editor) **MUST implement a double, explicit user confirmation** mechanism before invoking this tool. The server should provide configuration to disable this tool entirely.
    *   **Input Schema:**
        ```json
        {
          "type": "object",
          "properties": {
            "script": { "type": "string", "description": "The GlideScript code to execute." }
          },
          "required": ["script"]
        }
        ```
    *   **Output (Conceptual):** A JSON object containing the script's output (stdout, logs captured from `gs.log/print`), any error messages, and potentially execution time. Example: `{ "output": "...", "error": "...", "executionTimeMs": 120 }`. (Leverages `sys.scripts.do` endpoint or similar mechanism).
    *   **Use Case:** Allows developers to *very carefully* test small, generated code snippets in a *non-production* environment directly from their MCP tool, after multiple confirmations. Primarily for rapid iteration during development/debugging by experienced users aware of the risks.

**6. Future Considerations / Out of Scope for POC**

*   Production Readiness (Hardening, Logging, Monitoring, Testing).
*   Advanced Authentication (OAuth).
*   More Complex Tools (UI Actions, Workflows, Flow Designer, Scoped App details).
*   Caching mechanisms.
*   Write Operations *beyond* the explicitly dangerous `execute_script`.
*   Support for multiple instances concurrently.
*   Server-side enforcement of `execute_script` safety checks (difficult, relies heavily on client).

**7. Success Metrics (POC)**

*   Server connects to configured ServiceNow instance.
*   Read-only tools (`get_table_schema`, `get_field_choices`, `get_acl_details`, etc.) return accurate data when called via an MCP client.
*   The `execute_script` tool successfully executes a simple script (e.g., `gs.print('Hello');`) when called *after* appropriate warnings and hypothetical double confirmation in a test client, and returns the expected output.
*   Demonstration of an LLM (via an MCP-enabled tool like Cursor) using at least two *read-only* tools to generate context-aware ServiceNow code.
*   The `execute_script` tool can be successfully disabled via configuration.
*   Informal positive feedback from a developer testing the integration, acknowledging the risks of `execute_script`.

---