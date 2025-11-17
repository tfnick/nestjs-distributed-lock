export interface LockAcquireOptions {
  /** 锁超时时间（毫秒） */
  timeout?: number;
  
  /** 是否等待获取锁（true：等待直到超时，false：立即返回） */
  wait?: boolean;
  
  /** 自动重试次数 */
  maxRetries?: number;
  
  /** 重试间隔（毫秒） */
  retryDelay?: number;
}