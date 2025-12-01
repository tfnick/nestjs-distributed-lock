export interface LockAcquireOptions {
  /** 锁超时时间（毫秒） */
  timeout?: number;
  
  /** 是否等待获取锁（true：等待直到超时，false：立即返回） */
  wait?: boolean;
  
  /** 自动重试次数 */
  maxRetries?: number;
  /**
   * 重试延迟（毫秒）
   * @default 100
   */
  retryDelay?: number;

  /**
   * 锁持有时间（毫秒）
   * 如果指定了此时间，锁将在指定时间后自动释放
   * @default undefined (不自动释放)
   */
  ttl?: number;
}