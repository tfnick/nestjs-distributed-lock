import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { DistributedLockInterceptor } from '../interceptors/distributed-lock.interceptor';
import { LockAcquireOptions } from '../interfaces';

export const LOCK_METADATA_KEY = 'distributed-lock:options';

export interface LockDecoratorOptions extends LockAcquireOptions {
  key: string;
}

export type LockOptions = LockDecoratorOptions | string | ((...args: any[]) => LockDecoratorOptions);

/**
 * 分布式锁装饰器
 * 使用方式：
 * @Lock('resource-key')
 * @Lock({ key: 'resource-key', timeout: 5000 })
 * @Lock((orderId) => ({ key: `order:${orderId}`, timeout: 5000 }))
 */
export function Lock(options: LockOptions): MethodDecorator {
  const lockOptions = typeof options === 'string' 
    ? { key: options }
    : typeof options === 'function'
    ? { key: 'dynamic-lock', isDynamic: true, dynamicFn: options }
    : options;

  return applyDecorators(
    SetMetadata(LOCK_METADATA_KEY, lockOptions),
    UseInterceptors(DistributedLockInterceptor)
  );
}