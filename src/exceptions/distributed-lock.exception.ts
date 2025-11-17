import { HttpException, HttpStatus } from '@nestjs/common';

export class DistributedLockException extends HttpException {
  constructor(
    message: string,
    public readonly key?: string,
    public readonly errorCode?: string,
  ) {
    super(message, HttpStatus.CONFLICT);
  }
}

export class LockAcquireTimeoutException extends DistributedLockException {
  constructor(key: string, timeout: number) {
    super(
      `获取锁超时: ${key} (${timeout}ms)`,
      key,
      'LOCK_ACQUIRE_TIMEOUT',
    );
  }
}

export class LockAlreadyHeldException extends DistributedLockException {
  constructor(key: string) {
    super(`锁已被占用: ${key}`, key, 'LOCK_ALREADY_HELD');
  }
}

export class LockNotHeldException extends DistributedLockException {
  constructor(key: string) {
    super(`未持有锁: ${key}`, key, 'LOCK_NOT_HELD');
  }
}