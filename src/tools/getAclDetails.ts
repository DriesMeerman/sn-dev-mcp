import { ServiceNowService, getAuthenticatedClient } from '../services/serviceNowService.js';

// Interface for the detailed information returned for an ACL
interface AclDetails {
    name: string;
    type: string; // e.g., record, field
    operation: string; // e.g., read, write, create, delete
    admin_overrides: boolean;
    active: boolean;
    description: string | null;
    condition_script: string | null; // 'script' field in ServiceNow
    roles: string; // Comma-separated list of role names (or sys_ids if display value not available easily)
    scope: string; // Scope name/label
    updated_on: string;
    sys_id: string;
}

interface GetAclDetailsArgs {
    aclNameOrTable: string;
    operation?: string;
    type?: string;
}

export async function getAclDetails(
    args: GetAclDetailsArgs
): Promise<AclDetails[]> {

    const { aclNameOrTable, operation, type } = args;
    const client = getAuthenticatedClient();

    // Construct the base query for name/table.
    // Searches for exact name OR name starts with table.
    const nameQuery = `name=${aclNameOrTable}^ORnameSTARTSWITH${aclNameOrTable}.`;

    const queryParts: string[] = [nameQuery];

    // Add optional filters
    if (operation) {
        queryParts.push(`operation=${operation}`);
    }
    if (type) {
        queryParts.push(`type=${type}`);
    }

    const sysparm_query = queryParts.join('^');

    // Define fields to retrieve
    const sysparm_fields = 'name,type,operation,admin_overrides,active,description,script,roles,sys_scope.scope,sys_scope.name,sys_updated_on,sys_id';

    try {
        const response = await client.get<{ result: any[] }>('/table/sys_security_acl', {
            params: {
                sysparm_query,
                sysparm_fields,
                sysparm_limit: 100,
                sysparm_display_value: 'all'
            },
        });

        const results = response.result || [];

        // Map results to the details interface
        return results.map((acl: any): AclDetails => ({
            name: acl.name,
            type: acl.type?.value || acl.type,
            operation: acl.operation?.value || acl.operation,
            admin_overrides: acl.admin_overrides === 'true',
            active: acl.active === 'true',
            description: acl.description,
            condition_script: acl.script,
            roles: acl.roles?.display_value || acl.roles?.value || '' ,
            scope: acl.sys_scope?.scope?.value || acl.sys_scope?.name?.value || 'Global',
            updated_on: acl.sys_updated_on?.value || acl.sys_updated_on,
            sys_id: acl.sys_id,
        }));

    } catch (error) {
        // console.error(`Error fetching ACL details for query '${sysparm_query}':`, error);
        throw error;
    }
}