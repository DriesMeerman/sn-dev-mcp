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