import { 
  LockAcquireTimeoutException, 
  LockAlreadyHeldException, 
  LockNotHeldException 
} from './distributed-lock.exception';

describe('Lock Exceptions', () => {
  describe('LockAcquireTimeoutException', () => {
    it('should create exception with key and timeout', () => {
      const exception = new LockAcquireTimeoutException('test-key', 5000);
      
      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(LockAcquireTimeoutException);
      expect(exception.message).toContain('test-key');
      expect(exception.message).toContain('5000ms');
      expect(exception.name).toBe('LockAcquireTimeoutException');
      expect(exception.key).toBe('test-key');
      expect(exception.errorCode).toBe('LOCK_ACQUIRE_TIMEOUT');
    });

    it('should include default timeout message', () => {
      const exception = new LockAcquireTimeoutException('test-key', undefined);
      
      expect(exception.message).toContain('test-key');
    });
  });

  describe('LockAlreadyHeldException', () => {
    it('should create exception with key', () => {
      const exception = new LockAlreadyHeldException('test-key');
      
      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(LockAlreadyHeldException);
      expect(exception.message).toBe('锁已被占用: test-key');
      expect(exception.name).toBe('LockAlreadyHeldException');
      expect(exception.key).toBe('test-key');
      expect(exception.errorCode).toBe('LOCK_ALREADY_HELD');
    });
  });

  describe('LockNotHeldException', () => {
    it('should create exception with key', () => {
      const exception = new LockNotHeldException('test-key');
      
      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(LockNotHeldException);
      expect(exception.message).toBe('未持有锁: test-key');
      expect(exception.name).toBe('LockNotHeldException');
      expect(exception.key).toBe('test-key');
      expect(exception.errorCode).toBe('LOCK_NOT_HELD');
    });
  });
});