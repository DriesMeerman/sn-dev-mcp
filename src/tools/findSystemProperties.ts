import { ServiceNowService, getAuthenticatedClient } from '../services/serviceNowService.js';

// Represents details of a single system property
interface SystemPropertyDetail {
    name: string;
    value: string | null;
    description: string | null;
    scope: string; // Will hold scope's technical name or label
    updated_on: string;
}

// Function to find system properties by name (exact) or description (wildcard)
export async function findSystemProperties(
    searchTerm: string
): Promise<SystemPropertyDetail[]> {

    // Get authenticated client
    const client = getAuthenticatedClient();

    // Construct the query: exact match on name OR wildcard match on description
    const sysparm_query = `name=${searchTerm}^ORdescriptionLIKE${searchTerm}`;
    // Fields to retrieve, including dot-walking for scope name/label
    const sysparm_fields = 'name,value,description,sys_updated_on,sys_scope.scope,sys_scope.name';

    try {
        const response = await client.get<{ result: any[] }>('/table/sys_properties', {
            params: {
                sysparm_query,
                sysparm_fields,
                sysparm_limit: 50, // Return up to 50 matches
                sysparm_display_value: 'false', // Get raw values and sys_ids
            },
        });

        const results = response.result || [];

        // Map results to the SystemPropertyDetail interface
        return results.map((item: any): SystemPropertyDetail => ({
            name: item.name,
            value: item.value,
            description: item.description,
            // Use dot-walked scope technical name or label, default to Global
            scope: item['sys_scope.scope'] || item['sys_scope.name'] || 'Global',
            updated_on: item.sys_updated_on,
        }));

    } catch (error) {
        console.error(`Error fetching system properties matching '${searchTerm}':`, error);
        // Re-throw the error potentially formatted by the service interceptor
        throw error;
    }
}