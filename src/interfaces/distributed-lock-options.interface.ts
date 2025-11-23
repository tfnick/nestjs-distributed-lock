import {ModuleMetadata, Type} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface DistributedLockOptions {
  /** PostgreSQL连接名称（用于连接多个数据库的情况） */
  connectionName?: string;
  
  /** 自定义数据源（用于支持代理数据源） */
  dataSource?: DataSource;
  
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

export interface DistributedLockAsyncOptions
    extends Pick<ModuleMetadata, 'imports'> {
  inject?: any[];
  useExisting?: Type<DistributedLockOptionsFactory>;
  useClass?: Type<DistributedLockOptionsFactory>;
  useFactory?: (
      ...args: any[]
  ) => Promise<DistributedLockOptions> | DistributedLockOptions;
}