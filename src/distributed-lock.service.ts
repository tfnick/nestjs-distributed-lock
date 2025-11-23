import { Injectable, Inject, Logger } from '@nestjs/common';
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
  ) {
    this.defaultTimeout = options.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay ?? DEFAULT_RETRY_DELAY;

    // DataSource 只从 options 中读取
    if (!options.dataSource) {
      throw new Error(
          `DistributedLockModule options.dataSource is required.`,
      );
    }

    this.dataSource = options.dataSource;
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
          this.logger.debug(`成功获取锁: ${key}`);

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

    const result = await this.dataSource.query(
        'SELECT pg_advisory_unlock($1) AS unlocked',
        [lockKey],
    );

    if (!result[0]?.unlocked) {
      throw new LockNotHeldException(key);
    }

    this.logger.debug(`成功释放锁: ${key}`);
  }

  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.generateLockKey(key);

    const result = await this.dataSource.query(
        'SELECT objid FROM pg_locks WHERE locktype = $1 AND objid = $2 AND granted = true',
        ['advisory', lockKey],
    );

    return result.length > 0;
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
