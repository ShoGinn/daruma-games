import type {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    RawAxiosRequestConfig,
} from 'axios';
import axios from 'axios';
import { IRateLimiterOptions } from 'rate-limiter-flexible';

import { RateLimiter } from '../../../logic/rateLimiter.js';

export abstract class AbstractRequestEngine {
    public readonly baseUrl: string;
    protected readonly api: AxiosInstance;
    protected readonly rateLimits: IRateLimiterOptions;
    protected readonly limiter: RateLimiter;
    protected constructor(
        baseURL: string,
        opts?: AxiosRequestConfig,
        rateLimits: IRateLimiterOptions = { points: 1, duration: 1 }
    ) {
        this.api = this.createAxiosInstance(baseURL, opts);
        this.baseUrl = baseURL;
        this.rateLimits = rateLimits;
        this.limiter = new RateLimiter(this.rateLimits);
    }

    protected async rateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
        return await this.limiter.execute(request);
    }
    public async apiFetch<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
        return await this.api.get(url, config);
    }

    public static get baseOptions(): RawAxiosRequestConfig {
        return {
            timeout: 10_000,
            // only treat 5xx as errors
            validateStatus: (status): boolean => !(status >= 500 && status < 600),
        };
    }
    private createAxiosInstance(baseURL: string, opts?: AxiosRequestConfig): AxiosInstance {
        return axios.create({
            ...AbstractRequestEngine.baseOptions,
            ...opts,
            baseURL,
        });
    }
}
