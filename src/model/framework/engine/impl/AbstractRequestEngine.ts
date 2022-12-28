import type { AxiosInstance, AxiosRequestConfig, AxiosRequestHeaders } from 'axios';
import axios from 'axios';

import logger from '../../../../utils/functions/LoggerFactory.js';

export type InterceptorOptions = {
    headers?: AxiosRequestHeaders;
    params?: Record<string, any>;
};

export abstract class AbstractRequestEngine {
    public readonly baseUrl: string;
    protected readonly api: AxiosInstance;

    protected constructor(baseURL: string, opts?: InterceptorOptions) {
        this.api = this.axiosInterceptor(
            axios.create({
                ...AbstractRequestEngine.baseOptions,
                baseURL,
                ...opts,
            })
        );
        this.baseUrl = baseURL;
    }

    public static get baseOptions(): AxiosRequestConfig {
        return {
            timeout: 10000,
            // only treat 5xx as errors
            validateStatus: (status): boolean => !(status >= 500 && status < 600),
        };
    }

    private axiosInterceptor(axiosInstance: AxiosInstance): AxiosInstance {
        axiosInstance.interceptors.request.use(async request => {
            try {
                // holder
            } catch (error) {
                logger.error(`[*] ${error}`);
            }
            return request;
        });
        return axiosInstance;
    }
}
