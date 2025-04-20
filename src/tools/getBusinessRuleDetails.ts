import { ServiceNowService } from '../services/serviceNowService.js';
import { URL } from 'url';
import { AxiosRequestConfig } from 'axios';

// Interface for the detailed information returned
interface BusinessRuleDetails {
    name: string;
    table: string | null;
    when: string; // e.g., before, after, async, display
    order: number;
    active: boolean;
    insert: boolean;
    update: boolean;
    delete: boolean;
    query: boolean;
    condition: string | null; // Condition script or builder string
    scope: string; // Scope name/label
    updated_on: string;
    sys_id: string;
}

interface FindBusinessRulesArgs {
    businessRuleName?: string;
    tableName?: string;
}

// Renamed function to reflect capability
export async function findBusinessRules(
    args: FindBusinessRulesArgs,
    connectionString: string
): Promise<BusinessRuleDetails[]> { // Always return an array

    const { businessRuleName, tableName } = args;

    // Validate input: require at least one identifier
    if (!businessRuleName && !tableName) {
        throw new Error('Either businessRuleName or tableName must be provided.');
    }

    // Parse connection string
    let parsedUrl;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        console.error('Invalid connection string format for findBusinessRules', e);
        throw new Error('Invalid connection string format.');
    }
    const instanceUrl = parsedUrl.origin;
    const username = parsedUrl.username;
    const password = parsedUrl.password;

    if (!username || !password) {
        throw new Error('Username and password must be included in the connection string.');
    }

    // Instantiate the ServiceNow client
    const client = new ServiceNowService({
        instanceUrl,
        auth: { username, password }
    });

    // Construct query based on provided input
    const queryParts: string[] = [
        'collectionISNOTEMPTY' // Standard filter for Business Rules
    ];
    if (businessRuleName) {
        queryParts.push(`name=${businessRuleName}`);
    }
    if (tableName) {
        queryParts.push(`collection=${tableName}`);
    }
    const sysparm_query = queryParts.join('^');

    // Define fields to retrieve (remove 'script')
    const sysparm_fields = 'name,collection,when,order,active,action_insert,action_update,action_delete,action_query,condition,sys_scope.scope,sys_scope.name,sys_updated_on,sys_id';

    // Configure request parameters
    const params: AxiosRequestConfig['params'] = {
        sysparm_query,
        sysparm_fields,
        sysparm_display_value: 'false',
    };

    // Adjust limit and ordering based on search type
    if (tableName && !businessRuleName) {
        // Table search: order by execution order, higher limit
        params.sysparm_orderby = 'order';
        params.sysparm_limit = 50; // Allow more results for table search
    } else if (businessRuleName && !tableName) {
        // Name-only search: limit to 2 to detect ambiguity
        params.sysparm_limit = 2;
    } else {
        // Specific name and table search: limit to 1
        params.sysparm_limit = 1;
    }

    try {
        const response = await client.get<{ result: any[] }>('/table/sys_script', { params });

        const results = response.result || [];

        // Handle ambiguity for name-only search
        if (businessRuleName && !tableName && results.length > 1) {
            throw new Error(`Multiple Business Rules found with name '${businessRuleName}'. Please specify the tableName to disambiguate.`);
        }

        // Map results to the details interface
        return results.map((rule: any): BusinessRuleDetails => ({
            name: rule.name,
            table: rule.collection,
            when: rule.when,
            order: parseInt(rule.order, 10) || 0,
            active: rule.active === 'true',
            insert: rule.action_insert === 'true',
            update: rule.action_update === 'true',
            delete: rule.action_delete === 'true',
            query: rule.action_query === 'true',
            condition: rule.condition,
            scope: rule['sys_scope.scope'] || rule['sys_scope.name'] || 'Global',
            updated_on: rule.sys_updated_on,
            sys_id: rule.sys_id,
        }));

    } catch (error) {
        // Re-throw specific ambiguity error, otherwise log and re-throw general error
        if (error instanceof Error && error.message.startsWith('Multiple Business Rules found')) {
            throw error;
        }
        console.error(`Error fetching Business Rule details for query '${sysparm_query}':`, error);
        throw error;
    }
}