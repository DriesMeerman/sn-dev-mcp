import { ServiceNowService, getAuthenticatedClient } from '../services/serviceNowService.js';
// import { URL } from 'url'; // Import URL for parsing
import ts from 'typescript';

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

interface ScriptIncludeFunction {
    name: string;
    parameters: string[];
    jsDoc?: string;
    // Add line numbers? Range?
}

interface ScriptIncludeAPIResult {
    apiName: string; // e.g., IncidentUtils
    scriptContent?: string; // Optionally return full script
    functions: ScriptIncludeFunction[];
}

// Renamed and exported function
export async function getScriptIncludeApi(
    scriptIncludeName: string
    // connectionString: string
): Promise<ScriptIncludeAPIResult> {

    // Remove connection string parsing and client instantiation
    /*
    let parsedUrl;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        console.error('Invalid connection string format for getScriptIncludeApi', e);
        throw new Error('Invalid connection string format.');
    }
    const instanceUrl = parsedUrl.origin;
    const username = parsedUrl.username;
    const password = parsedUrl.password;

    if (!username || !password) {
        throw new Error('Username and password must be included in the connection string.');
    }
    const client = new ServiceNowService({
        instanceUrl,
        auth: { username, password }
    });
    */

    // Get authenticated client
    const client = getAuthenticatedClient();

    // Fetch the Script Include record
    let scriptContent = '';
    try {
        const response = await client.get<{ result: { script: string, api_name: string }[] }>('/table/sys_script_include', {
            params: {
                sysparm_query: `api_name=${scriptIncludeName}`,
                sysparm_fields: 'script,api_name',
                sysparm_limit: 1,
            },
        });

        if (!response.result || response.result.length === 0) {
            throw new Error(`Script Include '${scriptIncludeName}' not found.`);
        }
        scriptContent = response.result[0].script;
        // We already have the api_name, but could verify it matches:
        // const apiNameFromRecord = response.result[0].api_name;

    } catch (error) {
        console.error(`Error fetching Script Include '${scriptIncludeName}':`, error);
        throw error; // Re-throw original or formatted error
    }

    // Parse the script content using TypeScript compiler API
    const sourceFile = ts.createSourceFile(
        `${scriptIncludeName}.js`, // File name for context
        scriptContent,
        ts.ScriptTarget.Latest,
        true // setParentNodes
    );

    const apiResult: ScriptIncludeAPIResult = {
        apiName: scriptIncludeName,
        functions: [],
        // scriptContent: scriptContent // Uncomment to include script content
    };

    // Recursive function to find function declarations/expressions
    function findFunctions(node: ts.Node) {
        let functionName: string | undefined = undefined;
        let parameters: string[] = [];
        let nodeToExtractJsDocFrom: ts.Node | undefined = node;

        // Identify function declarations (e.g., function myFunction() {})
        if (ts.isFunctionDeclaration(node) && node.name) {
            functionName = node.name.text;
            parameters = node.parameters.map(p => p.name.getText(sourceFile));
        }
        // Identify function expressions assigned to variables/properties
        // (e.g., var myFunc = function() {}; Class.prototype.myMethod = function() {}; this.myMethod = function() {} )
        else if (ts.isVariableStatement(node)) {
            for (const decl of node.declarationList.declarations) {
                if (decl.initializer && ts.isFunctionExpression(decl.initializer) && ts.isIdentifier(decl.name)) {
                    functionName = decl.name.text;
                    parameters = decl.initializer.parameters.map(p => p.name.getText(sourceFile));
                    nodeToExtractJsDocFrom = decl.initializer; // JSDoc might be on the expression
                }
            }
        }
        else if (ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
            const left = node.expression.left;
            const right = node.expression.right;

            if (ts.isFunctionExpression(right)) {
                 // Handle Class.prototype.method = function()...
                if (ts.isPropertyAccessExpression(left) && left.name) {
                     functionName = left.name.text;
                }
                // Handle this.method = function()... (Corrected check)
                else if (ts.isPropertyAccessExpression(left) && left.expression.kind === ts.SyntaxKind.ThisKeyword && left.name) {
                     functionName = left.name.text;
                }
                // Could add more specific checks if needed

                 if (functionName) {
                      parameters = right.parameters.map(p => p.name.getText(sourceFile));
                      nodeToExtractJsDocFrom = right; // JSDoc might be on the expression
                 }
            }
        }

        if (functionName && nodeToExtractJsDocFrom) {
            const jsDoc = getJsDocString(nodeToExtractJsDocFrom);
            apiResult.functions.push({ name: functionName, parameters, jsDoc });
        }

        ts.forEachChild(node, findFunctions);
    }

    // Helper to extract JSDoc comments
    function getJsDocString(node: ts.Node): string | undefined {
        // @ts-ignore - internal TypeScript API might change, but necessary for JSDoc
        const comments = ts.getJSDocTags(node);
        if (comments && comments.length > 0) {
             // @ts-ignore
            return comments.map(tag => tag.comment ? `* ${tag.comment}` : '*').join('\n ');
        }
        // Fallback or alternative: Look for full text comments immediately preceding
        const commentRanges = ts.getLeadingCommentRanges(sourceFile.getFullText(), node.getFullStart());
        if (commentRanges) {
            for (const range of commentRanges) {
                if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia) {
                    const commentText = sourceFile.getFullText().substring(range.pos, range.end);
                    if (commentText.startsWith('/**')) { // Check if it looks like JSDoc
                        // Basic cleanup
                        return commentText
                            .replace(/^\/\*\*\s*\n?/, '') // Remove leading /**
                            .replace(/\n?\s*\*\/$/, '')   // Remove trailing */
                            .split('\n')
                            .map(line => line.replace(/^\s*\* ?/, '')) // Remove leading * per line
                            .join('\n');
                    }
                }
            }
        }
        return undefined;
    }

    findFunctions(sourceFile);

    return apiResult;
}