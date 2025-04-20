import {
    TableSchema,
    FieldSchema,
    ValueDisplayValue,
    SysDbObjectRecord,
    SysDbObjectResponse,
    SysDictionaryRecord,
    SysDictionaryResponse
} from "../types.js";
import { ServiceNowService } from "../services/serviceNowService.js";
import { URL } from 'url'; // Import URL for parsing


export async function getTableSchema(tableName: string, connectionString: string): Promise<TableSchema | null> {
    // Parse the connection string
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        throw new Error("Invalid connection string format. Expected format: https://user:password@instance.service-now.com");
    }

    const username = parsedUrl.username;
    const password = parsedUrl.password;
    const instanceUrl = parsedUrl.origin; // origin includes protocol + hostname

    if (!username || !password || !instanceUrl) {
        throw new Error("Connection string must include username, password, and instance URL (e.g., https://user:password@instance.service-now.com)"
        + "\n" + parsedUrl + "\n bap bap \n" + `connectionString: ${connectionString}` );
    }

    // Instantiate the service directly with parsed credentials
    const auth = { username, password };

    const service = new ServiceNowService({
        instanceUrl,
        auth: auth
    });

    try {
        // 1. Get Table Metadata from sys_db_object
        const tableObjectResponse = await service.get<SysDbObjectResponse>(
            `/table/sys_db_object`,
            {
                params: {
                    sysparm_query: `name=${tableName}`,
                    sysparm_limit: 1,
                    sysparm_fields: 'name,label,sys_id' // Request only needed fields
                }
            }
        );

        if (!tableObjectResponse.result || tableObjectResponse.result.length === 0) {
            console.warn(`Table '${tableName}' not found in ServiceNow instance.`); // Log warning
            return null; // Return null if table not found
        }
        const tableObject = tableObjectResponse.result[0];
        const actualTableName = tableObject.name;
        const tableLabel = tableObject.label || actualTableName; // Fallback label

        // 2. Get Field Definitions from sys_dictionary
        const dictionaryResponse = await service.get<SysDictionaryResponse>(
            `/table/sys_dictionary`,
            {
                params: {
                    // Query for dictionary entries for this table where element is not empty and entry is active
                    sysparm_query: `name=${actualTableName}^elementISNOTEMPTY^active=true`,
                    // Request necessary fields for FieldSchema
                    sysparm_fields: 'element,internal_type,column_label,reference,max_length,mandatory,read_only,comments',
                    sysparm_display_value: 'all' // Get both value and display_value where applicable
                }
            }
        );

        // 3. Map sys_dictionary results to FieldSchema[] (Renumbered)
        const mappedFields = (dictionaryResponse.result || []).map(dictEntry => {
            const maxLengthValue = dictEntry.max_length?.value;
            // Ensure we have the necessary fields before mapping
            if (!dictEntry.element?.value || !dictEntry.internal_type?.value) {
                console.warn(`Skipping dictionary entry for table ${actualTableName} due to missing element or internal_type:`, dictEntry);
                return null; // Skip this entry if core data is missing
            }

            const fieldType = dictEntry.internal_type.value;
            const fieldName = dictEntry.element.value;

            // Construct the field object conforming to FieldSchema
            const field: FieldSchema = {
                name: fieldName,
                label: dictEntry.column_label?.display_value || fieldName, // Fallback label to element name
                type: fieldType,
                description: dictEntry.comments?.value || '',
                // Only include referenceTable if the type is reference and value is present
                referenceTable: fieldType === 'reference' && dictEntry.reference?.value ? dictEntry.reference.value : undefined,
                maxLength: maxLengthValue ? parseInt(maxLengthValue.replace(/,/g, ''), 10) : undefined, // Parse to number, remove commas
                mandatory: dictEntry.mandatory?.value === 'true',
                readOnly: dictEntry.read_only?.value === 'true',
                // Removed choices property
            };
            return field;
        });

        // Filter out the null entries
        const fields: FieldSchema[] = mappedFields.filter(
            (field): field is FieldSchema => field !== null
        );

        const sortedFields = fields.sort((a, b) => a.name.localeCompare(b.name));

        // 4. Construct final TableSchema (Renumbered)
        const tableSchema: TableSchema = {
            label: tableLabel,
            name: actualTableName,
            fields: sortedFields, // Assign the filtered array
        };

        return tableSchema;

    } catch (error) {
        console.error(`Failed to get schema for table '${tableName}':`, error);
        // Rethrow the error which should be formatted by the service interceptor
        throw error;
    }
}
