import { Type } from '@nestjs/common';

export interface DistributedLockOptions {
  /** PostgreSQL连接名称（用于连接多个数据库的情况） */
  connectionName?: string;
  
  /** 默认锁超时时间（毫秒） */
  defaultTimeout?: number;
  
  /** 自动重试次数 */
  maxRetries?: number;
  
  /** 重试间隔（毫秒） */
  retryDelay?: number;
}

export interface DistributedLockOptionsFactory {
  createDistributedLockOptions(): Promise<DistributedLockOptions> | DistributedLockOptions;
}

export interface DistributedLockAsyncOptions {
  useExisting?: Type<DistributedLockOptionsFactory>;
  useClass?: Type<DistributedLockOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<DistributedLockOptions> | DistributedLockOptions;
  inject?: any[];
}