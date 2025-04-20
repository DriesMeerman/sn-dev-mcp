import { ServiceNowService } from '../services/serviceNowService.js';
import { URL } from 'url'; // Import URL for parsing

// Define the interface for the expected result from the ServiceNow API
interface ScriptIncludeRecord {
    result: {
        script?: string;
        sys_id?: string;
        name?: string;
        api_name?: string; // Added api_name
        // Add other relevant fields if needed
    }[];
}

interface ScriptIncludeApiResult {
    functionName: string;
    parameters: string[];
    jsdoc?: string;
}

// Regular expression to find JSDoc blocks followed by function definitions
// This is a simplified regex for POC and might need refinement for edge cases
// It looks for /** ... */ blocks followed by function declarations or assignments
const functionRegex = /\/\*\*\s*\n([^*]|(\*(?!\/)))*?\*\/\s*([\w.]+)\s*[:=]\s*function\s*\(([^)]*)\)/g;

// Simpler regex for functions without explicit JSDoc (might capture inner functions)
const functionWithoutJsDocRegex = /([\w.]+)\s*[:=]\s*function\s*\(([^)]*)\)/g;

// New: JSDoc + Object property function ( key: function() )
const objectFunctionRegex = /\/\*\*\s*\n([^*]|(\*(?!\/)))*?\*\/\s*(\w+)\s*:\s*function\s*\(([^)]*)\)/g;

// New: Object property function without JSDoc
const objectFunctionWithoutJsDocRegex = /(\w+)\s*:\s*function\s*\(([^)]*)\)/g;

// Regex to extract parameters from the matched parameter string
const paramsRegex = /\/\*.*?\*\/\s*([\w]+)|\b([\w]+)\b/g;

// Renamed and exported function
export async function getScriptIncludeApi(
    // Accept connection string instead of service instance
    scriptIncludeName: string,
    connectionString: string
): Promise<any> {
    // Removed direct param destructuring

    if (!scriptIncludeName) {
        throw new Error('Missing required parameter: scriptIncludeName');
    }
    if (!connectionString) {
        throw new Error("Missing connection string");
    }

    // Parse the connection string to create the service
    let parsedUrl: URL;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        throw new Error("Invalid connection string format. Expected format: https://user:password@instance.service-now.com");
    }
    const username = parsedUrl.username;
    const password = parsedUrl.password;
    const instanceUrl = parsedUrl.origin;
    if (!username || !password || !instanceUrl) {
        throw new Error("Connection string must include username, password, and instance URL");
    }
    const auth = { username, password };
    const serviceNowService = new ServiceNowService({
        instanceUrl,
        auth: auth
    });
    // Now proceed with the original logic using the created service
    try {
        // Fetch the Script Include record from ServiceNow
        const response = await serviceNowService.get<ScriptIncludeRecord>('/table/sys_script_include', {
            params: {
                sysparm_query: `name=${scriptIncludeName}^ORapi_name=${scriptIncludeName}`,
                sysparm_fields: 'script,name,sys_id,api_name',
                sysparm_limit: 1
            }
        });

        if (!response.result || response.result.length === 0) {
            return { message: `Script Include matching name or API name '${scriptIncludeName}' not found.` };
        }

        const record = response.result[0]; // Get the first matching record
        const scriptContent = record.script;
        const actualName = record.name;
        const apiName = record.api_name;

        if (!scriptContent) {
            return { message: `Script Include '${actualName || apiName}' found but has no script content.` };
        }

        const extractedApis: ScriptIncludeApiResult[] = [];
        const foundFunctions = new Set<string>(); // Keep track of functions found to avoid duplicates
        let match;

        // Pass 1: JSDoc + Standard function
        while ((match = functionRegex.exec(scriptContent)) !== null) {
            const jsdoc = match[0].match(/\/\*\*([^*]|(\*(?!\/)))*?\*\//)?.[0]; // Extract full JSDoc block
            const functionName = match[3];
            const paramString = match[4];
            if (jsdoc && functionName && !foundFunctions.has(functionName)) {
                const parameters = extractParameters(paramString);
                extractedApis.push({ functionName, parameters, jsdoc });
                foundFunctions.add(functionName);
            }
        }

        // Pass 2: JSDoc + Object property function
        while ((match = objectFunctionRegex.exec(scriptContent)) !== null) {
            const jsdoc = match[0].match(/\/\*\*([^*]|(\*(?!\/)))*?\*\//)?.[0];
            const functionName = match[3]; // Function name is the key
            const paramString = match[4];
             if (jsdoc && functionName && !foundFunctions.has(functionName)) {
                const parameters = extractParameters(paramString);
                extractedApis.push({ functionName, parameters, jsdoc });
                foundFunctions.add(functionName);
            }
        }

        // Pass 3: Standard function without JSDoc
        while ((match = functionWithoutJsDocRegex.exec(scriptContent)) !== null) {
            const functionName = match[1];
            const paramString = match[2];
             if (functionName && !foundFunctions.has(functionName)) {
                 const parameters = extractParameters(paramString);
                extractedApis.push({ functionName, parameters });
                foundFunctions.add(functionName);
            }
        }

        // Pass 4: Object property function without JSDoc
        while ((match = objectFunctionWithoutJsDocRegex.exec(scriptContent)) !== null) {
            const functionName = match[1]; // Function name is the key
            const paramString = match[2];
            if (functionName && !foundFunctions.has(functionName)) {
                const parameters = extractParameters(paramString);
                extractedApis.push({ functionName, parameters });
                foundFunctions.add(functionName);
            }
        }

        // Helper function to extract parameters cleanly
        function extractParameters(paramString: string): string[] {
            const parameters = [];
            let paramMatch;
            // Reset lastIndex since we are reusing the regex in a loop controlled elsewhere
            paramsRegex.lastIndex = 0;
            while ((paramMatch = paramsRegex.exec(paramString)) !== null) {
                if (paramMatch[1]) parameters.push(paramMatch[1].trim()); // Parameter with /* comment */
                else if (paramMatch[2]) parameters.push(paramMatch[2].trim()); // Parameter without comment
            }
            return parameters;
        }

        if (extractedApis.length === 0) {
             return {
                 message: `No public functions found in Script Include '${actualName || apiName}'. Parsing might need improvement for other coding styles.`,
                 name: actualName,
                 api_name: apiName
             };
        }

        // Format the output
        // Sort API results alphabetically by function name
        extractedApis.sort((a, b) => a.functionName.localeCompare(b.functionName));

        return {
            scriptIncludeName: scriptIncludeName, // The name used for searching
            name: actualName, // Actual name from the record
            api_name: apiName, // Actual api_name from the record
            api: extractedApis,
        };

    } catch (error: any) {
        console.error(`Error fetching/parsing Script Include API for ${scriptIncludeName}:`, error);
        throw new Error(`Failed to get Script Include API for '${scriptIncludeName}': ${error.message}`);
    }
}