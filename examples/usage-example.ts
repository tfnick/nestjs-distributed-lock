import { Controller, Post, Param, Injectable, Module } from '@nestjs/common';
import { DistributedLockModule } from '../src/distributed-lock.module';
import { DistributedLockService } from '../src/distributed-lock.service';
import { Lock } from '../src/decorators';

// 示例1: 在服务中使用分布式锁
@Injectable()
export class OrderService {
  constructor(private readonly lockService: DistributedLockService) {}

  // 使用 withLock 方法自动管理锁的生命周期
  async processOrder(orderId: string): Promise<string> {
    return await this.lockService.withLock(
      `order:${orderId}`,
      async () => {
        // 模拟业务处理逻辑
        console.log(`开始处理订单: ${orderId}`);
        await this.simulateBusinessLogic(orderId);
        return `订单 ${orderId} 处理完成`;
      },
      {
        timeout: 10000, // 10秒超时
        wait: true,     // 等待获取锁
        maxRetries: 3,  // 最大重试3次
      }
    );
  }

  // 手动管理锁的生命周期
  async updateOrderInventory(orderId: string, quantity: number): Promise<void> {
    const lock = await this.lockService.acquire(`inventory:${orderId}`, {
      timeout: 5000,
      wait: false, // 非阻塞模式，如果锁被占用立即返回
    });

    try {
      if (!lock) {
        throw new Error('无法获取锁，请稍后重试');
      }

      console.log(`更新库存: 订单 ${orderId}, 数量 ${quantity}`);
      await this.simulateInventoryUpdate(orderId, quantity);
    } finally {
      await lock.release();
    }
  }

  // 检查锁状态
  async checkOrderLock(orderId: string): Promise<boolean> {
    return await this.lockService.isLocked(`order:${orderId}`);
  }

  private async simulateBusinessLogic(orderId: string): Promise<void> {
    // 模拟业务处理时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`订单 ${orderId} 业务逻辑执行完成`);
  }

  private async simulateInventoryUpdate(orderId: string, _quantity: number): Promise<void> {
    // 模拟库存更新
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`订单 ${orderId} 库存更新完成`);
  }
}

// 示例2: 在控制器中使用装饰器（新的设计）
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post(':id/process')
  async processOrder(@Param('id') orderId: string): Promise<{ success: boolean; message: string }> {
    try {
      const result = await this.orderService.processOrder(orderId);
      return { success: true, message: result };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 使用装饰器方式的锁保护
  @Post(':id/process-with-decorator')
  @Lock({ key: 'order:process', timeout: 8000 })
  async processOrderWithDecorator(@Param('id') orderId: string): Promise<{ success: boolean; message: string }> {
    console.log(`使用装饰器处理订单: ${orderId}`);
    
    // 执行业务逻辑 - 简化示例
    await this.simulateBusinessLogic(orderId);
    
    return { success: true, message: `订单 ${orderId} 处理完成` };
  }

  // 支持动态锁键的装饰器
  @Post(':id/process-dynamic')
  @Lock((orderId: string) => ({ key: `order:${orderId}`, timeout: 5000 }))
  async processOrderDynamic(@Param('id') orderId: string): Promise<{ success: boolean; message: string }> {
    console.log(`使用动态锁键处理订单: ${orderId}`);
    
    // 执行业务逻辑 - 简化示例
    await this.simulateBusinessLogic(orderId);
    
    return { success: true, message: `订单 ${orderId} 处理完成` };
  }

  @Post(':id/check-lock')
  async checkLock(@Param('id') orderId: string): Promise<{ isLocked: boolean }> {
    const isLocked = await this.orderService.checkOrderLock(orderId);
    return { isLocked };
  }

  // 添加模拟业务逻辑方法
  private async simulateBusinessLogic(orderId: string): Promise<void> {
    // 模拟业务处理时间
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`订单 ${orderId} 业务逻辑执行完成`);
  }
}

// 示例3: 在任意服务中使用装饰器
@Injectable()
export class InventoryService {
  constructor(private readonly lockService: DistributedLockService) {}

  // 使用装饰器保护方法
  @Lock({ key: 'inventory:update', timeout: 3000 })
  async updateInventory(productId: string, quantity: number): Promise<void> {
    console.log(`更新产品库存: ${productId}, 数量 ${quantity}`);
    await this.simulateInventoryUpdate(productId, quantity);
  }

  private async simulateInventoryUpdate(productId: string, quantity: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log(`产品 ${productId} 库存更新完成`);
  }
}

// 示例模块配置
@Module({
  imports: [
    DistributedLockModule.forRoot({
      defaultTimeout: 30000, // 默认30秒超时
      maxRetries: 5,         // 最大重试5次
      retryDelay: 500,       // 重试间隔500毫秒
    }),
  ],
  controllers: [OrderController],
  providers: [OrderService, InventoryService],
})
export class ExampleModule {}

// 使用示例说明
/**
 * 重新设计后的分布式锁组件特性：
 * 
 * ✅ 不再依赖Express或任何HTTP框架
 * ✅ 使用NestJS拦截器实现真正的解耦
 * ✅ 支持服务级别的装饰器使用
 * ✅ 更优雅的API设计
 * 
 * 使用方式：
 * 
 * 1. 服务中使用 withLock 方法（推荐）
 *    - 自动获取和释放锁
 *    - 异常安全，确保锁被释放
 *    
 * 2. 使用装饰器保护方法
 *    - 声明式编程，代码更简洁
 *    - 支持动态锁键生成
 *    - 自动异常处理
 * 
 * 3. 手动管理锁（需要细粒度控制时）
 *    - 更灵活的控制
 *    - 支持非阻塞模式
 *    
 * 新设计的优势：
 * - 完全解耦，不依赖特定HTTP框架
 * - 可以在任何NestJS服务中使用
 * - 基于NestJS标准拦截器机制
 * - 更好的类型安全性和开发体验
 */