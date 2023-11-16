import algosdk from 'algosdk';
import Bottleneck from 'bottleneck';
import { DecorateAll } from 'decorate-all';

const limiter = new Bottleneck();
limiter.on('failed', (error, jobInfo) => {
  // 429 == rate limit
  // The return is the number of milliseconds to wait before retrying
  if (error.statusCode === 429 && jobInfo.retryCount < 3) {
    return 250;
  }
  if (error.statusCode === 429 && jobInfo.retryCount >= 3) {
    return 1000;
  }
  return 0;
});
const RateLimit = function (
  _target: unknown,
  _propertyKey: string | symbol,
  descriptor?: PropertyDescriptor,
): void {
  if (!descriptor) {
    return;
  }
  const original = descriptor.value;
  descriptor.value = function () {
    // eslint-disable-next-line prefer-rest-params
    const call = Reflect.apply(original, this, arguments);
    const originalDo = call.do;
    call.do = limiter.wrap(originalDo);
    return call;
  };
};

@DecorateAll(RateLimit, { deep: true })
export class WrappedIndexer extends algosdk.Indexer {}
