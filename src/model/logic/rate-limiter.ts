import { IRateLimiterOptions, RateLimiterMemory, RateLimiterQueue } from 'rate-limiter-flexible';

export class RateLimiter {
  private readonly limiter: RateLimiterQueue;

  constructor(options: IRateLimiterOptions) {
    this.limiter = new RateLimiterQueue(new RateLimiterMemory(options));
  }

  async execute<T>(request: () => Promise<T>): Promise<T> {
    await this.limiter.removeTokens(1);
    return await request();
  }
}
