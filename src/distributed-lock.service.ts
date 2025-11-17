import { Injectable, Inject, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DistributedLockOptions, LockAcquireOptions } from './interfaces';
import { DISTRIBUTED_LOCK_MODULE_OPTIONS, DEFAULT_TIMEOUT, DEFAULT_MAX_RETRIES, DEFAULT_RETRY_DELAY } from './distributed-lock.constants';
import { LockAcquireTimeoutException, LockAlreadyHeldException, LockNotHeldException } from './exceptions';

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

  constructor(
    @Inject(DISTRIBUTED_LOCK_MODULE_OPTIONS)
    private readonly options: DistributedLockOptions,
    private readonly dataSource: DataSource,
  ) {
    this.defaultTimeout = options.defaultTimeout || DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries || DEFAULT_MAX_RETRIES;
    this.retryDelay = options.retryDelay || DEFAULT_RETRY_DELAY;
  }

  /**
   * 获取分布式锁
   * @param key 锁的唯一标识符
   * @param options 锁选项
   * @returns 锁句柄，包含释放锁的方法
   */
  async acquire(
    key: string,
    options: LockAcquireOptions = {},
  ): Promise<LockHandle> {
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

        // 等待后重试
        if (attempt < maxRetries) {
          this.logger.debug(`锁已被占用，等待重试: ${key} (尝试 ${attempt + 1}/${maxRetries})`);
          await this.sleep(retryDelay);
        }
      } catch (error) {
        if (error instanceof LockAlreadyHeldException) {
          throw error;
        }
        
        this.logger.error(`获取锁失败: ${key}`, error);
        
        if (attempt === maxRetries) {
          throw new LockAcquireTimeoutException(key, timeout);
        }
        
        if (attempt < maxRetries) {
          await this.sleep(retryDelay);
        }
      }
    }

    throw new LockAcquireTimeoutException(key, timeout);
  }

  /**
   * 尝试获取锁
   */
  private async tryAcquireLock(
    lockKey: number,
    timeout: number,
    wait: boolean,
  ): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.connect();
      
      // 使用 pg_advisory_lock 获取锁
      if (wait) {
        // 等待获取锁
        await queryRunner.query('SELECT pg_advisory_lock($1)', [lockKey]);
        // 注意：等待模式下，连接会被保持用于后续的锁释放操作
        return true;
      } else {
        // 尝试立即获取锁（不等待）
        const result = await queryRunner.query(
          'SELECT pg_try_advisory_lock($1) as locked',
          [lockKey],
        );
        
        const locked = result[0]?.locked === true;
        
        // 非等待模式下，无论是否获取成功都释放连接
        await queryRunner.release();
        
        return locked;
      }
    } catch (error) {
      // 发生错误时确保连接被释放
      await queryRunner.release().catch(releaseError => {
        this.logger.error('释放查询运行器失败', releaseError);
      });
      throw error;
    }
  }

  /**
   * 释放锁
   */
  async release(key: string): Promise<void> {
    const lockKey = this.generateLockKey(key);
    
    try {
      const result = await this.dataSource.query(
        'SELECT pg_advisory_unlock($1) as unlocked',
        [lockKey],
      );
      
      if (result[0]?.unlocked === true) {
        this.logger.debug(`成功释放锁: ${key}`);
      } else {
        throw new LockNotHeldException(key);
      }
    } catch (error) {
      if (error instanceof LockNotHeldException) {
        throw error;
      }
      
      this.logger.error(`释放锁失败: ${key}`, error);
      throw new LockNotHeldException(key);
    }
  }

  /**
   * 检查锁是否被持有
   */
  async isLocked(key: string): Promise<boolean> {
    const lockKey = this.generateLockKey(key);
    
    try {
      const result = await this.dataSource.query(
        'SELECT objid FROM pg_locks WHERE locktype = $1 AND objid = $2 AND granted = true',
        ['advisory', lockKey],
      );
      
      return result.length > 0;
    } catch (error) {
      this.logger.error(`检查锁状态失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 使用锁执行一段代码（自动获取和释放锁）
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: LockAcquireOptions = {},
  ): Promise<T> {
    const lock = await this.acquire(key, options);
    
    try {
      return await fn();
    } finally {
      await lock.release().catch((error) => {
        this.logger.error(`释放锁时发生错误: ${key}`, error);
      });
    }
  }

  /**
   * 生成锁键（将字符串转换为数字）
   */
  private generateLockKey(key: string): number {
    // 使用简单的哈希算法将字符串转换为数字
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash);
  }

  /**
   * 等待指定时间
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}