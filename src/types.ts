export interface FieldSchema {
    name: string; // The technical field name (element)
    label: string; // The display label for the field (column_label)
    type: string; // ServiceNow internal type (internal_type.value)
    description: string; // Optional description or hint
    referenceTable?: string; // Name of the referenced table, if type is 'reference'
    maxLength?: number; // Max length from sys_dictionary (max_length.value)
    mandatory?: boolean; // Is the field mandatory? (mandatory.value)
    readOnly?: boolean; // Is the field read-only? (read_only.value)
}

export interface TableSchema {
    label: string;
    name: string;
    fields: FieldSchema[]; // Use the exported FieldSchema interface
}

export enum MimeType {
    JSON = 'application/json',
    XML = 'application/xml',
    CSV = 'text/csv',
    HTML = 'text/html',
    TEXT = 'text/plain',
}

export interface Resource {
    name: string;
    mimeType: MimeType;
    uri: string;
}

// Helper type for fields that return value/display_value pairs
export interface ValueDisplayValue {
    value: string;
    display_value: string;
    link?: string; // Optional link
}

// --- Interfaces for ServiceNow API Responses ---

// Interface for a single record from sys_db_object
export interface SysDbObjectRecord {
    name: string; // Technical table name
    label: string; // Display label for the table
    sys_id: string;
    // Add other sys_db_object fields if needed
}

// Interface for the response from /api/now/table/sys_db_object
export interface SysDbObjectResponse {
    result: SysDbObjectRecord[];
}

// Interface for a single record from sys_dictionary
export interface SysDictionaryRecord {
    element: ValueDisplayValue; // Field name
    internal_type: ValueDisplayValue; // Field type
    column_label?: ValueDisplayValue; // Field display label
    reference?: ValueDisplayValue; // Referenced table name (for reference type)
    max_length?: ValueDisplayValue; // Max length
    mandatory?: ValueDisplayValue; // Mandatory flag ('true'/'false')
    read_only?: ValueDisplayValue; // Read-only flag ('true'/'false')
    comments?: ValueDisplayValue; // Field comments/description
    // Add other sys_dictionary fields if needed
}

// Interface for the response from /api/now/table/sys_dictionary
export interface SysDictionaryResponse {
    result: SysDictionaryRecord[];
}

// --- Interfaces for ServiceNow sys_choice API Response ---

// Interface for a single record from sys_choice (needed for getFieldChoices)
export interface SysChoiceRecord {
    element: ValueDisplayValue; // Field name (used for filtering, though API returns it)
    value: ValueDisplayValue;   // Choice value
    label: ValueDisplayValue;   // Choice label
    inactive: ValueDisplayValue; // Inactive flag ('true'/'false')
    // sequence?: ValueDisplayValue;    // Optional sequence for ordering
}

// Interface for the response from /api/now/table/sys_choice (needed for getFieldChoices)
export interface SysChoiceResponse {
    result: SysChoiceRecord[];
}

// Simple type for representing a field choice (output of getFieldChoices)
export interface FieldChoice {
    value: string;
    label: string;
}