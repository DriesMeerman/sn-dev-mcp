import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

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
                // Centralized error handling/logging
                console.error("ServiceNow API Error:", error.response?.status, error.response?.data || error.message);
                 if (axios.isAxiosError(error) && error.response) {
                    // Improve error message for common issues
                    const apiError = error.response.data?.error;
                    const message = apiError?.message || error.message;
                    const detail = apiError?.detail;
                    throw new Error(`ServiceNow API Error (${error.response.status}): ${message}${detail ? ` - ${detail}` : ''}`);
                }
                // Rethrow for caller to handle
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