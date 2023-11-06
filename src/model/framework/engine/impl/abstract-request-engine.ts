import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  RawAxiosRequestConfig,
} from 'axios';
import axios from 'axios';
import Bottleneck from 'bottleneck';

export abstract class AbstractRequestEngine {
  public readonly baseUrl: string;
  protected readonly api: AxiosInstance;
  private readonly limiter: Bottleneck;
  protected constructor(baseURL: string, options?: AxiosRequestConfig) {
    this.api = this.createAxiosInstance(baseURL, options);
    this.baseUrl = baseURL;
    this.limiter = new Bottleneck({
      minTime: 1000, // minimum time between job executions in milliseconds
    });
  }

  public async apiFetch<T>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return await this.limiter.schedule(() => this.api.get(url, config));
  }

  public static get baseOptions(): RawAxiosRequestConfig {
    return {
      timeout: 10_000,
      // only treat 5xx as errors
      validateStatus: (status): boolean => !(status >= 500 && status < 600),
    };
  }
  private createAxiosInstance(baseURL: string, options?: AxiosRequestConfig): AxiosInstance {
    return axios.create({
      ...AbstractRequestEngine.baseOptions,
      ...options,
      baseURL,
    });
  }
}
