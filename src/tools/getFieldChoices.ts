import {
    ValueDisplayValue,
    SysChoiceResponse,
    SysChoiceRecord,
    FieldChoice // Added for the return type
} from "../types.js";
import { ServiceNowService, getAuthenticatedClient } from "../services/serviceNowService.js";

/**
 * Fetches the available choices for a specific field on a specific ServiceNow table.
 *
 * This is useful for fields that represent a selection, such as those with type 'choice',
 * or integer fields representing states (e.g., incident state). It queries the `sys_choice`
 * table for active choices associated with the given table and field name.
 *
 * @param tableName The technical name of the ServiceNow table (e.g., 'incident').
 * @param fieldName The technical name of the field (element) on the table (e.g., 'state').
 * @returns A promise that resolves to an array of FieldChoice objects sorted by label, or null if the field/table has no choices or an error occurs.
 */
export async function getFieldChoices(
    tableName: string,
    fieldName: string
): Promise<FieldChoice[] | null> {
    // Get authenticated client
    const client = getAuthenticatedClient();

    try {
        // Construct the query for sys_choice table
        const sysparm_query = `name=${tableName}^element=${fieldName}^inactive=false`;
        // Fetch value and label, sort by sequence
        const sysparm_fields = 'value,label,sequence';
        const sysparm_orderby = 'sequence';

        // Use the authenticated client
        const response = await client.get<{ result: any[] }>('/table/sys_choice', {
            params: {
                sysparm_query,
                sysparm_fields,
                sysparm_orderby,
                sysparm_exclude_reference_link: true,
                sysparm_limit: 1000 // High limit for choices
            },
        });

        const results = response.result || [];

        // Map the results to the FieldChoice interface
        return results.map((choice: any): FieldChoice => ({
            value: choice.value,
            label: choice.label,
            // sequence: parseInt(choice.sequence, 10) || 0 // Sequence might be useful later
        }));

    } catch (error) {
        // Comment out error log
        // console.error(`Error fetching choices for field \'${fieldName}\' on table \'${tableName}\':`, error);
        return null;
    }
}