/**
 * 图片降级策略 - 当图片加载慢时提供备用方案
 */
class ImageFallbackStrategy {
  constructor() {
    this.slowLoadingThreshold = 8000; // 8秒认为是慢加载
    this.loadingTimes = []; // 记录最近的加载时间
    this.maxRecords = 10; // 最多记录10次加载时间
    this.consecutiveSlowLoads = 0; // 连续慢加载次数
    this.fallbackMode = false; // 是否启用降级模式
  }

  /**
   * 记录图片加载时间
   * @param {number} loadTime - 加载时间（毫秒）
   */
  recordLoadTime(loadTime) {
    this.loadingTimes.push({
      time: loadTime,
      timestamp: Date.now()
    });

    // 保持记录数量在限制内
    if (this.loadingTimes.length > this.maxRecords) {
      this.loadingTimes.shift();
    }

    // 检查是否为慢加载
    if (loadTime > this.slowLoadingThreshold) {
      this.consecutiveSlowLoads++;
      console.warn(`检测到慢加载: ${loadTime}ms (连续${this.consecutiveSlowLoads}次)`);
      
      // 连续3次慢加载启用降级模式
      if (this.consecutiveSlowLoads >= 3 && !this.fallbackMode) {
        this.enableFallbackMode();
      }
    } else {
      this.consecutiveSlowLoads = 0;
      
      // 如果加载速度恢复正常，可以考虑退出降级模式
      if (this.fallbackMode && loadTime < 3000) {
        this.checkExitFallbackMode();
      }
    }
  }

  /**
   * 启用降级模式
   */
  enableFallbackMode() {
    this.fallbackMode = true;
    console.log('🔄 启用图片降级模式');
    
    // 显示用户提示
    if (window.imageViewerApp?.state?.modules?.imageViewer?.uiController) {
      window.imageViewerApp.state.modules.imageViewer.uiController.showUserFeedback(
        '检测到网络较慢，已启用快速模式', 
        3000
      );
    }

    // 调整预加载策略
    this.adjustPreloadStrategy();
  }

  /**
   * 检查是否可以退出降级模式
   */
  checkExitFallbackMode() {
    // 检查最近5次加载是否都比较快
    const recentLoads = this.loadingTimes.slice(-5);
    const allFast = recentLoads.every(record => record.time < 3000);
    
    if (allFast && recentLoads.length >= 5) {
      this.exitFallbackMode();
    }
  }

  /**
   * 退出降级模式
   */
  exitFallbackMode() {
    this.fallbackMode = false;
    this.consecutiveSlowLoads = 0;
    console.log('✅ 退出图片降级模式');
    
    // 显示用户提示
    if (window.imageViewerApp?.state?.modules?.imageViewer?.uiController) {
      window.imageViewerApp.state.modules.imageViewer.uiController.showUserFeedback(
        '网络速度已恢复，退出快速模式', 
        2000
      );
    }

    // 恢复正常预加载策略
    this.restorePreloadStrategy();
  }

  /**
   * 调整预加载策略
   */
  adjustPreloadStrategy() {
    if (window.imageViewerApp?.state?.modules?.imageViewer?.preloadStrategy) {
      const preloadStrategy = window.imageViewerApp.state.modules.imageViewer.preloadStrategy;
      
      // 减少预加载数量
      preloadStrategy.options.preloadCount = 1;
      preloadStrategy.options.maxPreloadCount = 2;
      
      console.log('📉 已调整预加载策略：减少预加载数量');
    }
  }

  /**
   * 恢复预加载策略
   */
  restorePreloadStrategy() {
    if (window.imageViewerApp?.state?.modules?.imageViewer?.preloadStrategy) {
      const preloadStrategy = window.imageViewerApp.state.modules.imageViewer.preloadStrategy;
      
      // 恢复正常预加载数量
      preloadStrategy.options.preloadCount = 3;
      preloadStrategy.options.maxPreloadCount = 8;
      
      console.log('📈 已恢复预加载策略：恢复正常预加载数量');
    }
  }

  /**
   * 获取平均加载时间
   * @returns {number} 平均加载时间（毫秒）
   */
  getAverageLoadTime() {
    if (this.loadingTimes.length === 0) return 0;
    
    const total = this.loadingTimes.reduce((sum, record) => sum + record.time, 0);
    return total / this.loadingTimes.length;
  }

  /**
   * 获取加载统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const avgTime = this.getAverageLoadTime();
    const slowLoads = this.loadingTimes.filter(record => record.time > this.slowLoadingThreshold).length;
    
    return {
      averageLoadTime: avgTime,
      totalRecords: this.loadingTimes.length,
      slowLoads: slowLoads,
      slowLoadPercentage: this.loadingTimes.length > 0 ? (slowLoads / this.loadingTimes.length * 100) : 0,
      consecutiveSlowLoads: this.consecutiveSlowLoads,
      fallbackMode: this.fallbackMode
    };
  }

  /**
   * 预测下次加载是否可能很慢
   * @returns {boolean} 是否可能慢加载
   */
  predictSlowLoading() {
    if (this.loadingTimes.length < 3) return false;
    
    // 检查最近3次加载的趋势
    const recent = this.loadingTimes.slice(-3);
    const slowCount = recent.filter(record => record.time > this.slowLoadingThreshold).length;
    
    return slowCount >= 2 || this.fallbackMode;
  }

  /**
   * 获取建议的超时时间
   * @returns {number} 建议的超时时间（毫秒）
   */
  getSuggestedTimeout() {
    const avgTime = this.getAverageLoadTime();
    
    if (this.fallbackMode) {
      return 8000; // 降级模式下使用较短超时
    }
    
    if (avgTime > 15000) {
      return 20000; // 如果平均很慢，给更多时间
    } else if (avgTime > 8000) {
      return 15000; // 中等慢度
    } else {
      return 10000; // 正常超时
    }
  }

  /**
   * 重置统计数据
   */
  reset() {
    this.loadingTimes = [];
    this.consecutiveSlowLoads = 0;
    this.fallbackMode = false;
    console.log('🔄 图片降级策略已重置');
  }
}

// 创建全局实例
window.imageFallbackStrategy = new ImageFallbackStrategy();

console.log('📊 图片降级策略已加载');
console.log('💡 功能说明：');
console.log('  - 自动检测图片加载速度');
console.log('  - 连续慢加载时启用快速模式');
console.log('  - 网络恢复时自动退出快速模式');
console.log('  - 动态调整预加载策略');