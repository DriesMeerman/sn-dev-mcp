import {
    ValueDisplayValue,
    SysChoiceResponse,
    SysChoiceRecord,
    FieldChoice // Added for the return type
} from "../types.js";
import { ServiceNowService } from "../services/serviceNowService.js";
import { URL } from 'url';

/**
 * Fetches the available choices for a specific field on a specific ServiceNow table.
 *
 * This is useful for fields that represent a selection, such as those with type 'choice',
 * or integer fields representing states (e.g., incident state). It queries the `sys_choice`
 * table for active choices associated with the given table and field name.
 *
 * @param tableName The technical name of the ServiceNow table (e.g., 'incident').
 * @param fieldName The technical name of the field (element) on the table (e.g., 'state').
 * @param connectionString The ServiceNow connection string (e.g., 'https://user:password@instance.service-now.com').
 * @returns A promise that resolves to an array of FieldChoice objects sorted by label, or null if the field/table has no choices or an error occurs.
 */
export async function getFieldChoices(
    tableName: string,
    fieldName: string,
    connectionString: string
): Promise<FieldChoice[] | null> {
    // Parse the connection string (same logic as getTableSchema)
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        console.error("Invalid connection string format.", e);
        throw new Error("Invalid connection string format. Expected format: https://user:password@instance.service-now.com");
    }

    const username = parsedUrl.username;
    const password = parsedUrl.password;
    const instanceUrl = parsedUrl.origin;

    if (!username || !password || !instanceUrl) {
        throw new Error("Connection string must include username, password, and instance URL.");
    }

    const auth = { username, password };
    const service = new ServiceNowService({
        instanceUrl,
        auth: auth
    });

    try {
        // Fetch active choices for the specific table and field
        const choiceResponse = await service.get<SysChoiceResponse>(
            `/table/sys_choice`,
            {
                params: {
                    sysparm_query: `name=${tableName}^element=${fieldName}^inactive=false`,
                    sysparm_fields: 'value,label', // Request only value and label
                    sysparm_display_value: 'all' // Get both value and display_value for label
                }
            }
        );

        if (!choiceResponse.result || choiceResponse.result.length === 0) {
            console.log(`No active choices found for field '${fieldName}' on table '${tableName}'.`);
            return []; // Return empty array if no choices found
        }

        // Map results to FieldChoice[] and filter out any invalid entries
        const choices: FieldChoice[] = choiceResponse.result
            .map(choiceEntry => {
                // Ensure both value and label are present
                if (choiceEntry.value?.value && choiceEntry.label?.display_value) {
                    return {
                        value: choiceEntry.value.value,
                        label: choiceEntry.label.display_value
                    };
                } else {
                    console.warn(`Skipping invalid choice entry for ${tableName}.${fieldName}:`, choiceEntry);
                    return null; // Mark invalid entries as null
                }
            })
            .filter((choice): choice is FieldChoice => choice !== null); // Filter out the null entries

        // Sort choices by label
        choices.sort((a, b) => a.label.localeCompare(b.label));

        return choices;

    } catch (error) {
        console.error(`Failed to get choices for field '${fieldName}' on table '${tableName}':`, error);
        // Depending on requirements, you might return null or rethrow
        // Returning null indicates an issue fetching, vs empty array meaning no choices exist.
        return null;
        // throw error; // Or rethrow if the caller should handle it
    }
}