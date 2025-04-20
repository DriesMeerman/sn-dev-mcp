import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { URL } from 'url'; // Import URL for parsing in initializeService

interface ServiceNowAuth {
    username?: string;
    password?: string;
    // Add other auth methods like OAuth tokens if needed
}

interface ServiceNowServiceOptions {
    instanceUrl: string;
    auth: ServiceNowAuth;
}

export class ServiceNowService {
    private axiosInstance: AxiosInstance;
    private instanceUrl: string;
    private auth: ServiceNowAuth;

    constructor(options: ServiceNowServiceOptions) {
        this.instanceUrl = options.instanceUrl.startsWith('https://')
            ? options.instanceUrl
            : `https://${options.instanceUrl}`;
        this.auth = options.auth;

        // Validate required auth parameters
        if (!this.auth.username || !this.auth.password) {
            throw new Error("ServiceNowService requires username and password in auth options.");
        }

        this.axiosInstance = axios.create({
            baseURL: `${this.instanceUrl}/api/now`, // Base path for ServiceNow REST API
            auth: { // Basic Auth configuration using provided credentials
                username: this.auth.username,
                password: this.auth.password,
            },
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
        });

        // Optional: Interceptor for more complex auth or error handling
        this.axiosInstance.interceptors.response.use(
            response => response,
            error => {
                // Comment out centralized error logging
                // console.error("ServiceNow API Error:", error.response?.status, error.response?.data || error.message);
                 if (axios.isAxiosError(error) && error.response) {
                    const apiError = error.response.data?.error;
                    const message = apiError?.message || error.message;
                    const detail = apiError?.detail;
                    throw new Error(`ServiceNow API Error (${error.response.status}): ${message}${detail ? ` - ${detail}` : ''}`);
                }
                return Promise.reject(error);
            }
        );
    }

    /**
     * Performs a GET request to a ServiceNow API endpoint.
     * @param path The API path relative to /api/now (e.g., /table/incident)
     * @param config Optional Axios request configuration (e.g., params)
     * @returns Promise<T> The response data
     */
    async get<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> {
        try {
            const response = await this.axiosInstance.get<T>(path, config);
            return response.data;
        } catch (error) {
            // Error is already processed by the interceptor, rethrow it
            throw error;
        }
    }

    // Add other methods like post, put, delete as needed
    // async post<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> { ... }
    // async put<T = any>(path: string, data?: any, config?: AxiosRequestConfig): Promise<T> { ... }
    // async delete<T = any>(path: string, config?: AxiosRequestConfig): Promise<T> { ... }
}

// --- Singleton Logic ---

let authenticatedInstance: ServiceNowService | null = null;

/**
 * Initializes the singleton ServiceNowService instance.
 * Should be called once at application startup (e.g., in main).
 * Parses the connection string to extract credentials and URL.
 * @param connectionString The full connection string (e.g., https://username:password@instance.service-now.com)
 */
export function initializeService(connectionString: string): void {
    if (authenticatedInstance) {
        // Comment out warning
        // console.warn("ServiceNowService already initialized. Ignoring subsequent call.");
        return;
    }

    if (!connectionString) {
        throw new Error("Initialization failed: Connection string is required.");
    }

    // Parse connection string
    let parsedUrl;
    try {
        parsedUrl = new URL(connectionString);
    } catch (e) {
        throw new Error('Initialization failed: Invalid connection string format. Expected: https://username:password@instance.service-now.com');
    }

    const instanceUrl = parsedUrl.origin; // e.g., https://instance.service-now.com
    const username = decodeURIComponent(parsedUrl.username); // Handle potential encoding
    const password = decodeURIComponent(parsedUrl.password); // Handle potential encoding

    if (!username || !password) {
        throw new Error('Initialization failed: Username and password must be included in the connection string.');
    }

    // Comment out initialization log
    // console.error(`Initializing ServiceNowService for instance: ${instanceUrl}`); // Log initialization to stderr
    authenticatedInstance = new ServiceNowService({
        instanceUrl,
        auth: { username, password }
    });
}

/**
 * Retrieves the initialized singleton ServiceNowService instance.
 * Throws an error if the service has not been initialized via initializeService.
 * @returns The authenticated ServiceNowService client.
 */
export function getAuthenticatedClient(): ServiceNowService {
    if (!authenticatedInstance) {
        throw new Error("ServiceNowService not initialized. Call initializeService first.");
    }
    return authenticatedInstance;
}