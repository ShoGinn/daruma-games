import type { AxiosInstance, AxiosRequestConfig, RawAxiosRequestConfig } from 'axios';
import axios from 'axios';
import { IRateLimiterOptions, RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

export abstract class AbstractRequestEngine {
    public readonly baseUrl: string;
    protected readonly api: AxiosInstance;
    protected readonly rateLimits: IRateLimiterOptions;
    protected readonly limiter: RateLimiterQueue;
    protected constructor(
        baseURL: string,
        opts?: AxiosRequestConfig,
        { points, duration }: IRateLimiterOptions = { points: 1, duration: 1 }
    ) {
        this.api = this.axiosInterceptor(
            axios.create({
                ...AbstractRequestEngine.baseOptions,
                ...opts,
                baseURL,
            })
        );
        this.baseUrl = baseURL;
        this.rateLimits = { points, duration };
        this.limiter = new RateLimiterQueue(new RateLimiterMemory(this.rateLimits));
    }

    protected async rateLimitedRequest<T>(request: () => Promise<T>): Promise<T> {
        return await this.limiter
            .removeTokens(1)
            .then(() => {
                return request();
            })
            .catch(() => {
                throw new Error('Queue is full');
            });
    }

    public static get baseOptions(): RawAxiosRequestConfig {
        return {
            timeout: 10_000,
            // only treat 5xx as errors
            validateStatus: (status): boolean => !(status >= 500 && status < 600),
        };
    }

    private axiosInterceptor(axiosInstance: AxiosInstance): AxiosInstance {
        axiosInstance.interceptors.request.use(request => request);
        return axiosInstance;
    }
}
