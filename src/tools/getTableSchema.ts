import { ServiceNowService, getAuthenticatedClient } from "../services/serviceNowService.js";
import {
    TableSchema,
    FieldSchema,
    SysDbObjectResponse,
    SysDictionaryResponse
} from "../types.js";

export async function getTableSchema(tableName: string): Promise<TableSchema | null> {
    const client = getAuthenticatedClient();

    try {
        const tableObjectResponse = await client.get<SysDbObjectResponse>(
            `/table/sys_db_object`,
            {
                params: {
                    sysparm_query: `name=${tableName}`,
                    sysparm_limit: 1,
                    sysparm_fields: 'name,label,sys_id'
                }
            }
        );

        if (!tableObjectResponse.result || tableObjectResponse.result.length === 0) {
            console.warn(`Table '${tableName}' not found in ServiceNow instance.`);
            return null;
        }
        const tableObject = tableObjectResponse.result[0];
        const actualTableName = tableObject.name;
        const tableLabel = tableObject.label || actualTableName;

        const dictionaryResponse = await client.get<SysDictionaryResponse>(
            `/table/sys_dictionary`,
            {
                params: {
                    sysparm_query: `name=${actualTableName}^elementISNOTEMPTY^active=true`,
                    sysparm_fields: 'element,internal_type,column_label,reference,max_length,mandatory,read_only,comments',
                    sysparm_display_value: 'all'
                }
            }
        );

        const mappedFields = (dictionaryResponse.result || []).map(dictEntry => {
            const maxLengthValue = dictEntry.max_length?.value;
            if (!dictEntry.element?.value || !dictEntry.internal_type?.value) {
                console.warn(`Skipping dictionary entry for table ${actualTableName} due to missing element or internal_type:`, dictEntry);
                return null;
            }

            const fieldType = dictEntry.internal_type.value;
            const fieldName = dictEntry.element.value;

            const field: FieldSchema = {
                name: fieldName,
                label: dictEntry.column_label?.display_value || fieldName,
                type: fieldType,
                description: dictEntry.comments?.value || '',
                referenceTable: fieldType === 'reference' && dictEntry.reference?.value ? dictEntry.reference.value : undefined,
                maxLength: maxLengthValue ? parseInt(maxLengthValue.replace(/,/g, ''), 10) : undefined,
                mandatory: dictEntry.mandatory?.value === 'true',
                readOnly: dictEntry.read_only?.value === 'true',
            };
            return field;
        });

        const fields: FieldSchema[] = mappedFields.filter(
            (field): field is FieldSchema => field !== null
        );

        const sortedFields = fields.sort((a, b) => a.name.localeCompare(b.name));

        const tableSchema: TableSchema = {
            label: tableLabel,
            name: actualTableName,
            fields: sortedFields,
        };

        return tableSchema;

    } catch (error) {
        console.error(`Failed to get schema for table '${tableName}':`, error);
        throw error;
    }
}
