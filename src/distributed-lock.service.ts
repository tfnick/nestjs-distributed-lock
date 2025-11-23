import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DistributedLockOptions, LockAcquireOptions } from './interfaces';
import {
  DISTRIBUTED_LOCK_MODULE_OPTIONS,
  DEFAULT_TIMEOUT,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY,
} from './distributed-lock.constants';
import {
  LockAcquireTimeoutException,
  LockAlreadyHeldException,
  LockNotHeldException,
} from './exceptions';

export interface LockHandle {
  key: string;
  release: () => Promise<void>;
}

@Injectable()
export class DistributedLockService {
  private readonly logger = new Logger(DistributedLockService.name);
  private readonly defaultTimeout: number;
  private readonly maxRetries: number;
  private readonly retryDelay: number;
  private readonly dataSource: DataSource;

  constructor(
    @Inject(DISTRIBUTED_LOCK_MODULE_OPTIONS)
    private readonly options: DistributedLockOptions,
    @Optional() @Inject(DataSource) private readonly defaultDataSource?: DataSource,
  ) {
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    
    // 使用自定义数据源（支持代理数据源）或默认数据源
    this.dataSource = options.dataSource || defaultDataSource!;
  }

  async acquire(key: string, options: LockAcquireOptions = {}): Promise<LockHandle> {
    const {
      timeout = this.defaultTimeout,
      wait = true,
      maxRetries = this.maxRetries,
      retryDelay = this.retryDelay,
    } = options;

    const lockKey = this.generateLockKey(key);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const acquired = await this.tryAcquireLock(lockKey, timeout, wait);

        if (acquired) {
          this.logger.debug(`acquire lock success: ${key}`);

          return {
            key,
            release: () => this.release(key),
          };
        }

        if (!wait) {
          throw new LockAlreadyHeldException(key);
        }

        if (attempt < maxRetries) {
          this.logger.debug(
              `锁占用，等待重试: ${key} (${attempt + 1}/${maxRetries})`,
          );
          await this.sleep(retryDelay);
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw new LockAcquireTimeoutException(key, timeout);
        }

        await this.sleep(retryDelay);
      }
    }

    throw new LockAcquireTimeoutException(key, timeout);
  }

  private async tryAcquireLock(
      lockKey: number,
      timeout: number,
      wait: boolean,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      if (wait) {
        await queryRunner.query('SELECT pg_advisory_lock($1)', [lockKey]);
        return true;
      } else {
        const result = await queryRunner.query(
            'SELECT pg_try_advisory_lock($1) AS locked',
            [lockKey],
        );

        const locked = result[0]?.locked === true;
        await queryRunner.release();
        return locked;
      }
    } catch (error) {
      await queryRunner.release().catch(() => {});
      throw error;
    }
  }

  async release(key: string): Promise<void> {
    const lockKey = this.generateLockKey(key);

    try {
      const result = await this.dataSource.query(
          'SELECT pg_advisory_unlock($1) AS unlocked',
          [lockKey],
      );

      if (!result[0]?.unlocked) {
        // throw new LockNotHeldException(key);
        this.logger.debug(`release ignored, lock not held: ${key}`);
      }

      this.logger.debug(`release lock success: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to release lock ${key}:`, error);
      throw error; // 重新抛出错误，让测试能够捕获
    }
  }

  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.generateLockKey(key);

    try {
      const result = await this.dataSource.query(
          'SELECT objid FROM pg_locks WHERE locktype = $1 AND objid = $2 AND granted = true',
          ['advisory', lockKey],
      );

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Failed to check lock status for ${key}:`, error);
      return false;
    }
  }

  async withLock<T>(
      key: string,
      fn: () => Promise<T>,
      options: LockAcquireOptions = {},
  ): Promise<T> {
    const lock = await this.acquire(key, options);

    try {
      return await fn();
    } finally {
      await lock.release().catch((e) => {
        this.logger.error(`释放锁失败 ${key}`, e);
      });
    }
  }

  private generateLockKey(key: string): number {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      hash = (hash << 5) - hash + key.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
