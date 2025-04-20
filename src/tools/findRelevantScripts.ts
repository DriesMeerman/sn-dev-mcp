import { ServiceNowService, getAuthenticatedClient } from '../services/serviceNowService.js';

interface FindScriptsArgs {
  tableName?: string;
  keywords?: string;
  scriptType?: string;
  scopeName?: string;
}

interface ScriptResult {
  name: string;
  type: string; // e.g., "Business Rule", "Script Include", "Client Script"
  table: string | null; // Relevant for Business Rules and Client Scripts
  sys_id: string;
  updated_on: string;
  scope: string; // Scope name
  reason: string; // Add reason field
}

// Map user-friendly script types to ServiceNow table names and type strings
const SCRIPT_TYPE_MAP: { [key: string]: { table: string; typeLabel: string } } = {
  'business rule': { table: 'sys_script', typeLabel: 'Business Rule' },
  'script include': { table: 'sys_script_include', typeLabel: 'Script Include' },
  'client script': { table: 'sys_script_client', typeLabel: 'Client Script' },
};

export async function findRelevantScripts(
  args: FindScriptsArgs
): Promise<ScriptResult[]> {
  const { tableName, keywords, scriptType, scopeName } = args;

  // Get authenticated client
  const client = getAuthenticatedClient();

  let scopeSysId: string | null = null;
  const reasonParts: string[] = []; // Store parts of the reason string

  // 1. Find scope sys_id (by technical name OR label) and build reason
  if (scopeName) {
    // Update reason to reflect search by name or label
    reasonParts.push(`scope(name/label)=\'${scopeName}\'`);
    try {
      // Update query to search both scope and name fields
      const scopeQuery = `scope=${scopeName}^ORname=${scopeName}`;
      const scopeResult = await client.get<{ result: { sys_id: string }[] }>('/table/sys_scope', {
        params: {
          sysparm_query: scopeQuery,
          sysparm_fields: 'sys_id', // Only need sys_id
          sysparm_limit: 1, // Take the first match
        },
      });
      if (scopeResult.result?.length > 0) {
        scopeSysId = scopeResult.result[0].sys_id;
      } else {
        // Comment out warning
        // console.warn(`Scope with name or label \'${scopeName}\' not found.`);
        if (!tableName && !keywords && !scriptType) {
          return [];
        }
        reasonParts.pop();
        scopeSysId = null;
        // Comment out warning
        // console.warn(`Continuing search without scope filter.`);
      }
    } catch (error) {
      // Comment out error log
      // console.error(`Error fetching scope sys_id for \'${scopeName}\':`, error);
      reasonParts.pop();
      scopeSysId = null;
      // Comment out error log
      // console.error('Continuing search without scope filter due to error.');
    }
  }

  // Add other criteria to reason
  if (tableName) reasonParts.push(`tableName=\'${tableName}\'`);
  if (keywords) reasonParts.push(`keywords=\'${keywords}\'`);
  if (scriptType) reasonParts.push(`scriptType=\'${scriptType}\'`);

  // Check if any criteria remain after potential scope removal
  if (reasonParts.length === 0) {
    // This should only happen if only scopeName was provided and it wasn't found/errored
    return [];
  }

  const reasonString = `Matched criteria: ${reasonParts.join(', ')}`;

  const scriptTypesToQuery = scriptType
    ? [SCRIPT_TYPE_MAP[scriptType.toLowerCase()]].filter(Boolean) // Filter specific type
    : Object.values(SCRIPT_TYPE_MAP); // Default to all types

  if (scriptTypesToQuery.length === 0 && scriptType) {
    throw new Error(`Invalid scriptType specified: '${scriptType}'. Valid types are: ${Object.keys(SCRIPT_TYPE_MAP).join(', ')}.`);
  }

  const allResults: ScriptResult[] = [];

  // 2. Query each relevant script table
  for (const { table, typeLabel } of scriptTypesToQuery) {
    const queryParts: string[] = [];

    if (tableName && (table === 'sys_script' || table === 'sys_script_client')) {
      const tableFieldName = table === 'sys_script' ? 'collection' : 'table';
      queryParts.push(`${tableFieldName}=${tableName}`);
    } else if (tableName && table === 'sys_script_include') {
      if (!keywords) {
        queryParts.push(`nameLIKE${tableName}^ORscriptLIKE${tableName}`);
      }
    }

    if (keywords) {
      queryParts.push(`nameLIKE${keywords}^ORscriptLIKE${keywords}`);
    }

    // Use the scopeSysId found earlier to filter the script table's sys_scope field
    if (scopeSysId) {
      queryParts.push(`sys_scope=${scopeSysId}`);
    }

    if (queryParts.length === 0) continue;

    const sysparm_query = queryParts.join('^');

    try {
      const response = await client.get<{ result: any[] }>(`/table/${table}`, {
        params: {
          sysparm_query,
          sysparm_fields: 'name,sys_id,sys_updated_on,sys_scope.scope,sys_scope.name' + (table !== 'sys_script_include' ? ',table,collection' : ''),
          sysparm_limit: 50,
          sysparm_display_value: 'false',
        },
      });

      const results = response.result || [];
      results.forEach((item: any) => {
        allResults.push({
          name: item.name,
          type: typeLabel,
          table: item.collection || item.table || null,
          sys_id: item.sys_id,
          updated_on: item.sys_updated_on,
          scope: item['sys_scope.scope'] || item['sys_scope.name'] || 'Global',
          reason: reasonString,
        });
      });
    } catch (error: any) {
      // Comment out error log
      // console.error(`Error querying ${table} with query '${sysparm_query}':`, error);
    }
  }

  allResults.sort((a, b) => b.updated_on.localeCompare(a.updated_on));

  return allResults;
}
