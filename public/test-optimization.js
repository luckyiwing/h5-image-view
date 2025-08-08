/**
 * 性能优化测试脚本
 * 用于验证优化效果
 */

class OptimizationTester {
  constructor() {
    this.testResults = {
      cacheTests: [],
      loadTimeTests: [],
      memoryTests: [],
      apiCallTests: []
    };
  }

  /**
   * 运行所有优化测试
   */
  async runAllTests() {
    console.group('🧪 性能优化测试开始');
    
    try {
      await this.testCacheOptimization();
      await this.testLoadTimeOptimization();
      await this.testMemoryOptimization();
      await this.testApiCallOptimization();
      
      this.generateTestReport();
    } catch (error) {
      console.error('测试执行失败:', error);
    }
    
    console.groupEnd();
  }

  /**
   * 测试缓存优化效果
   */
  async testCacheOptimization() {
    console.log('📦 测试缓存优化...');
    
    if (window.imageViewerApp?.state?.modules?.imageViewer?.browserCacheOptimizer) {
      const optimizer = window.imageViewerApp.state.modules.imageViewer.browserCacheOptimizer;
      const stats = optimizer.getStats();
      
      this.testResults.cacheTests.push({
        timestamp: Date.now(),
        serviceWorkerReady: stats.serviceWorkerReady,
        preloadedCount: stats.preloadedCount,
        cacheStrategy: stats.cacheStrategy,
        maxAge: stats.maxAge
      });
      
      console.log('缓存优化器状态:', stats);
    } else {
      console.warn('缓存优化器未找到');
    }
  }

  /**
   * 测试加载时间优化
   */
  async testLoadTimeOptimization() {
    console.log('⏱️ 测试加载时间优化...');
    
    const testUrl = 'https://pic.rmb.bdstatic.com/bjh/test-image.jpg';
    const startTime = performance.now();
    
    try {
      // 模拟图片加载
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = testUrl;
      });
      
      const loadTime = performance.now() - startTime;
      this.testResults.loadTimeTests.push({
        timestamp: Date.now(),
        url: testUrl,
        loadTime: loadTime,
        success: true
      });
      
      console.log(`图片加载时间: ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      console.warn('图片加载测试失败:', error);
      this.testResults.loadTimeTests.push({
        timestamp: Date.now(),
        url: testUrl,
        loadTime: -1,
        success: false,
        error: error.message
      });
    }
  }

  /**
   * 测试内存优化
   */
  async testMemoryOptimization() {
    console.log('💾 测试内存优化...');
    
    if ('memory' in performance) {
      const memoryInfo = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
      
      this.testResults.memoryTests.push({
        timestamp: Date.now(),
        ...memoryInfo,
        usagePercent: (memoryInfo.used / memoryInfo.total * 100).toFixed(2)
      });
      
      console.log('内存使用情况:', {
        used: (memoryInfo.used / 1024 / 1024).toFixed(2) + 'MB',
        total: (memoryInfo.total / 1024 / 1024).toFixed(2) + 'MB',
        usage: (memoryInfo.used / memoryInfo.total * 100).toFixed(2) + '%'
      });
    } else {
      console.warn('浏览器不支持内存信息获取');
    }
  }

  /**
   * 测试API调用优化
   */
  async testApiCallOptimization() {
    console.log('🌐 测试API调用优化...');
    
    if (window.imageViewerApp?.state?.modules?.imageViewer?.apiService) {
      const apiService = window.imageViewerApp.state.modules.imageViewer.apiService;
      
      // 记录API调用间隔
      const lastCall = apiService.lastApiCall;
      const minInterval = apiService.minApiInterval;
      const now = Date.now();
      
      this.testResults.apiCallTests.push({
        timestamp: now,
        lastApiCall: lastCall,
        minInterval: minInterval,
        timeSinceLastCall: now - lastCall,
        pendingRequestsCount: apiService.pendingRequests.size
      });
      
      console.log('API调用优化状态:', {
        最小间隔: minInterval + 'ms',
        距离上次调用: (now - lastCall) + 'ms',
        待处理请求: apiService.pendingRequests.size
      });
    } else {
      console.warn('API服务未找到');
    }
  }

  /**
   * 生成测试报告
   */
  generateTestReport() {
    console.group('📊 优化测试报告');
    
    // 缓存优化报告
    if (this.testResults.cacheTests.length > 0) {
      const latest = this.testResults.cacheTests[this.testResults.cacheTests.length - 1];
      console.log('✅ 缓存优化:', {
        状态: latest.serviceWorkerReady ? '已启用' : '使用Cache API',
        预加载数量: latest.preloadedCount,
        缓存策略: latest.cacheStrategy
      });
    }
    
    // 加载时间报告
    if (this.testResults.loadTimeTests.length > 0) {
      const successful = this.testResults.loadTimeTests.filter(t => t.success);
      if (successful.length > 0) {
        const avgLoadTime = successful.reduce((sum, t) => sum + t.loadTime, 0) / successful.length;
        console.log('⚡ 加载时间优化:', {
          平均加载时间: avgLoadTime.toFixed(2) + 'ms',
          成功率: (successful.length / this.testResults.loadTimeTests.length * 100).toFixed(1) + '%'
        });
      }
    }
    
    // 内存优化报告
    if (this.testResults.memoryTests.length > 0) {
      const latest = this.testResults.memoryTests[this.testResults.memoryTests.length - 1];
      console.log('🧠 内存优化:', {
        当前使用: (latest.used / 1024 / 1024).toFixed(2) + 'MB',
        使用率: latest.usagePercent + '%',
        状态: parseFloat(latest.usagePercent) < 50 ? '良好' : '需要关注'
      });
    }
    
    // API调用优化报告
    if (this.testResults.apiCallTests.length > 0) {
      const latest = this.testResults.apiCallTests[this.testResults.apiCallTests.length - 1];
      console.log('🔄 API调用优化:', {
        频率控制: latest.timeSinceLastCall >= latest.minInterval ? '正常' : '受限',
        请求去重: latest.pendingRequestsCount === 0 ? '无重复' : `${latest.pendingRequestsCount}个待处理`
      });
    }
    
    console.groupEnd();
  }

  /**
   * 获取测试结果
   */
  getTestResults() {
    return this.testResults;
  }
}

// 创建全局测试实例
window.optimizationTester = new OptimizationTester();

// 页面加载完成后自动运行测试
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      window.optimizationTester.runAllTests();
    }, 3000); // 等待3秒让应用完全初始化
  });
} else {
  setTimeout(() => {
    window.optimizationTester.runAllTests();
  }, 3000);
}

console.log('🧪 性能优化测试脚本已加载，将在3秒后自动运行测试');