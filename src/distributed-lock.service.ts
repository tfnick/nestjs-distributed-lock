import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DistributedLockOptions, LockAcquireOptions, AnyDataSource } from './interfaces';
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
  private readonly dataSource: AnyDataSource;

  constructor(
    @Inject(DISTRIBUTED_LOCK_MODULE_OPTIONS)
    private readonly options: DistributedLockOptions,
    @Optional() @Inject(DataSource) private readonly defaultDataSource?: AnyDataSource,
  ) {
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;
    
    // 使用自定义数据源（支持代理数据源）或默认数据源
    if (!options.dataSource && !defaultDataSource) {
      throw new Error('DataSource is required. Please either provide a dataSource option or ensure TypeORM DataSource is available.');
    }
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
    this.logger.debug(`acquiring lock for: ${lockKey} original key: ${key}`);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { acquired, queryRunner } = await this.tryAcquireLock(lockKey, timeout, wait);

        if (acquired) {
          this.logger.debug(`acquire lock success: ${lockKey} original key: ${key}`);

          return {
            key,
            release: () => this.releaseWithRunner(key, lockKey, queryRunner),
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
  ): Promise<{ acquired: boolean; queryRunner?: any }> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      if (wait) {
        await queryRunner.query('SELECT pg_advisory_lock($1)', [lockKey]);
        // 注意：不释放queryRunner，保持事务和锁
        return { acquired: true, queryRunner };
      } else {
        const result = await queryRunner.query(
            'SELECT pg_try_advisory_lock($1) AS locked',
            [lockKey],
        );

        const locked = result[0]?.locked === true;
        // 对于非阻塞锁，我们需要立即释放queryRunner和锁
        if (locked) {
          await queryRunner.query('SELECT pg_advisory_unlock($1)', [lockKey]);
        }
        await queryRunner.release();
        return { acquired: locked };
      }
    } catch (error) {
      await queryRunner.release().catch(() => {});
      throw error;
    }
  }

  async release(key: string): Promise<void> {
    const lockKey = this.generateLockKey(key);
    this.logger.debug(`releasing lock: ${lockKey} original key: ${key}`);

    try {
      const result = await this.dataSource.query(
          'SELECT pg_advisory_unlock($1) AS unlocked',
          [lockKey],
      );

      if (!result[0]?.unlocked) {
        // 不要抛出异常，只记录警告
        // 因为PostgreSQL advisory lock可能在事务结束时自动释放
        this.logger.debug(`release ignored, lock not held: ${lockKey} original key: ${key}`);
      }

      this.logger.debug(`release lock success: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to release lock ${key}:`, error);
      // 不要重新抛出错误，避免影响业务逻辑
    }
  }

  private async releaseWithRunner(key: string, lockKey: number, queryRunner: any): Promise<void> {
    this.logger.debug(`releasing lock with runner: ${lockKey} original key: ${key}`);

    try {
      if (queryRunner) {
        // 使用相同的queryRunner释放锁
        await queryRunner.query('SELECT pg_advisory_unlock($1) AS unlocked', [lockKey]);
        await queryRunner.release();
      } else {
        // 回退到常规释放
        await this.release(key);
      }

      this.logger.debug(`release lock success: ${key}`);
    } catch (error) {
      // 确保释放queryRunner
      if (queryRunner) {
        await queryRunner.release().catch(() => {});
      }
      this.logger.error(`Failed to release lock ${key}:`, error);
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
    // 使用更强的哈希算法确保唯一性
    // PostgreSQL advisory lock接受64位有符号整数
    const hash = this.fnv1a32(key);
    
    // 确保是正数并且在合理范围内
    return Math.abs(hash) % 2147483647; // PostgreSQL最大正整数
  }

  /**
   * FNV-1a 32位哈希算法
   * 具有良好的分布性和较低的冲突率
   */
  private fnv1a32(str: string): number {
    let hash = 0x811c9dc5; // FNV偏移基础值
    
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193); // FNV质数
    }
    
    // 确保结果在32位范围内
    return hash >>> 0;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
