/**
 * 性能优化和缓存管理模块
 * 提供图片缓存、预加载、性能监控等功能
 */

/**
 * 图片缓存管理器
 */
class ImageCache {
  constructor(options = {}) {
    this.maxCacheSize = options.maxCacheSize || 50; // 最大缓存数量
    this.maxMemorySize = options.maxMemorySize || 100 * 1024 * 1024; // 100MB
    this.cache = new Map();
    this.accessTimes = new Map();
    this.imageSizes = new Map();
    this.currentMemoryUsage = 0;

    console.log("ImageCache 初始化完成", {
      maxCacheSize: this.maxCacheSize,
      maxMemorySize: this.maxMemorySize,
    });
  }

  /**
   * 获取缓存的图片
   * @param {string} url - 图片URL
   * @returns {Promise<HTMLImageElement>|null} 缓存的图片元素或null
   */
  get(url) {
    if (this.cache.has(url)) {
      // 更新访问时间
      this.accessTimes.set(url, Date.now());
      const cachedImage = this.cache.get(url);

      console.log("从缓存获取图片:", url);
      return Promise.resolve(cachedImage.cloneNode());
    }
    return null;
  }

  /**
   * 缓存图片
   * @param {string} url - 图片URL
   * @param {HTMLImageElement} imageElement - 图片元素
   * @returns {Promise<void>}
   */
  async set(url, imageElement) {
    try {
      // 估算图片内存占用
      const imageSize = this.estimateImageSize(imageElement);

      // 检查是否需要清理缓存
      await this.ensureCacheSpace(imageSize);

      // 缓存图片
      this.cache.set(url, imageElement.cloneNode());
      this.accessTimes.set(url, Date.now());
      this.imageSizes.set(url, imageSize);
      this.currentMemoryUsage += imageSize;

      console.log("图片已缓存:", {
        url,
        size: imageSize,
        totalMemory: this.currentMemoryUsage,
        cacheCount: this.cache.size,
      });
    } catch (error) {
      console.error("缓存图片失败:", error);
    }
  }

  /**
   * 估算图片内存占用
   * @param {HTMLImageElement} imageElement - 图片元素
   * @returns {number} 估算的内存占用（字节）
   */
  estimateImageSize(imageElement) {
    const width = imageElement.naturalWidth || imageElement.width || 800;
    const height = imageElement.naturalHeight || imageElement.height || 600;
    // 假设每像素4字节（RGBA）
    return width * height * 4;
  }

  /**
   * 确保缓存空间足够
   * @param {number} requiredSize - 需要的空间大小
   */
  async ensureCacheSpace(requiredSize) {
    // 检查数量限制
    while (this.cache.size >= this.maxCacheSize) {
      this.removeLeastRecentlyUsed();
    }

    // 检查内存限制
    while (
      this.currentMemoryUsage + requiredSize > this.maxMemorySize &&
      this.cache.size > 0
    ) {
      this.removeLeastRecentlyUsed();
    }
  }

  /**
   * 移除最近最少使用的缓存项
   */
  removeLeastRecentlyUsed() {
    let oldestUrl = null;
    let oldestTime = Date.now();

    for (const [url, accessTime] of this.accessTimes) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestUrl = url;
      }
    }

    if (oldestUrl) {
      this.remove(oldestUrl);
      console.log("移除LRU缓存项:", oldestUrl);
    }
  }

  /**
   * 移除指定URL的缓存
   * @param {string} url - 图片URL
   */
  remove(url) {
    if (this.cache.has(url)) {
      const imageSize = this.imageSizes.get(url) || 0;
      this.currentMemoryUsage -= imageSize;

      this.cache.delete(url);
      this.accessTimes.delete(url);
      this.imageSizes.delete(url);
    }
  }

  /**
   * 清空所有缓存
   */
  clear() {
    this.cache.clear();
    this.accessTimes.clear();
    this.imageSizes.clear();
    this.currentMemoryUsage = 0;
    console.log("缓存已清空");
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      memoryUsage: this.currentMemoryUsage,
      maxMemorySize: this.maxMemorySize,
      memoryUsagePercent: (
        (this.currentMemoryUsage / this.maxMemorySize) *
        100
      ).toFixed(2),
    };
  }

  /**
   * 预热缓存 - 预加载指定的图片URL列表
   * @param {string[]} urls - 图片URL列表
   * @returns {Promise<void>}
   */
  async preload(urls) {
    const preloadPromises = urls.map((url) => this.preloadSingle(url));
    await Promise.allSettled(preloadPromises);
  }

  /**
   * 预加载单个图片
   * @param {string} url - 图片URL
   * @returns {Promise<HTMLImageElement>}
   */
  async preloadSingle(url) {
    return new Promise((resolve, reject) => {
      // 检查是否已缓存
      if (this.cache.has(url)) {
        resolve(this.cache.get(url));
        return;
      }

      const img = new Image();
      img.onload = async () => {
        await this.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`预加载图片失败: ${url}`));
      };
      img.src = url;
    });
  }
}

/**
 * 图片预加载策略管理器
 */
class PreloadStrategy {
  constructor(apiService, imageCache, options = {}) {
    this.apiService = apiService;
    this.imageCache = imageCache;
    this.preloadCount = options.preloadCount || 3; // 预加载数量
    this.preloadDelay = options.preloadDelay || 1000; // 预加载延迟
    this.isPreloading = false;
    this.preloadQueue = [];
    this.preloadedUrls = new Set();
    this.imageViewer = options.imageViewer; // ImageViewer实例，用于访问队列

    console.log("PreloadStrategy 初始化完成", {
      preloadCount: this.preloadCount,
      preloadDelay: this.preloadDelay,
    });
  }

  /**
   * 开始预加载策略
   */
  async startPreloading() {
    if (this.isPreloading) {
      return;
    }

    this.isPreloading = true;
    console.log("开始预加载策略");

    try {
      // 预加载指定数量的图片
      for (let i = 0; i < this.preloadCount; i++) {
        await this.preloadNext();

        // 添加延迟避免过于频繁的API调用
        if (i < this.preloadCount - 1) {
          await this.delay(this.preloadDelay);
        }
      }
    } catch (error) {
      console.error("预加载策略执行失败:", error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 预加载下一张图片
   */
  async preloadNext() {
    try {
      const imageUrl = await this.apiService.fetchImage();

      // 避免重复预加载
      if (this.preloadedUrls.has(imageUrl)) {
        console.log("图片已预加载，跳过:", imageUrl);
        return;
      }

      await this.imageCache.preloadSingle(imageUrl);
      this.preloadedUrls.add(imageUrl);

      // 将预加载的URL添加到队列中
      if (
        this.imageViewer &&
        typeof this.imageViewer.addToQueue === "function"
      ) {
        this.imageViewer.addToQueue(imageUrl);
      }

      console.log("预加载完成:", imageUrl);
    } catch (error) {
      console.warn("预加载图片失败:", error);
    }
  }

  /**
   * 智能预加载 - 根据用户行为调整预加载策略
   * @param {string} _currentImageUrl - 当前显示的图片URL
   */
  async smartPreload(_currentImageUrl) {
    // 如果正在预加载，跳过
    if (this.isPreloading) {
      return;
    }

    // 检查缓存命中率，调整预加载策略
    const cacheStats = this.imageCache.getStats();
    const shouldPreload = cacheStats.cacheSize < this.preloadCount;

    if (shouldPreload) {
      console.log("触发智能预加载");
      await this.startPreloading();
    }
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 停止预加载
   */
  stopPreloading() {
    this.isPreloading = false;
    console.log("预加载策略已停止");
  }

  /**
   * 清理预加载状态
   */
  cleanup() {
    this.stopPreloading();
    this.preloadQueue = [];
    this.preloadedUrls.clear();
  }
}

/**
 * 性能监控器
 */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      imageLoadTimes: [],
      apiCallTimes: [],
      cacheHitRate: { hits: 0, misses: 0 },
      memoryUsage: [],
      userInteractions: [],
      errors: [],
    };

    this.startTime = performance.now();
    this.setupPerformanceObserver();

    console.log("PerformanceMonitor 初始化完成");
  }

  /**
   * 设置性能观察器
   */
  setupPerformanceObserver() {
    if ("PerformanceObserver" in window) {
      try {
        // 观察资源加载性能
        const resourceObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.initiatorType === "img") {
              this.recordImageLoadTime(entry);
            }
          }
        });
        resourceObserver.observe({ entryTypes: ["resource"] });

        // 观察用户交互性能
        const interactionObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordUserInteraction(entry);
          }
        });
        interactionObserver.observe({ entryTypes: ["event"] });
      } catch (error) {
        console.warn("性能观察器设置失败:", error);
      }
    }
  }

  /**
   * 记录图片加载时间
   * @param {PerformanceResourceTiming} entry - 性能条目
   */
  recordImageLoadTime(entry) {
    const loadTime = entry.responseEnd - entry.requestStart;
    this.metrics.imageLoadTimes.push({
      url: entry.name,
      loadTime,
      size: entry.transferSize,
      timestamp: Date.now(),
    });

    // 保持最近100条记录
    if (this.metrics.imageLoadTimes.length > 100) {
      this.metrics.imageLoadTimes.shift();
    }

    console.log("记录图片加载时间:", {
      url: entry.name,
      loadTime: loadTime.toFixed(2) + "ms",
    });
  }

  /**
   * 记录API调用时间
   * @param {number} startTime - 开始时间
   * @param {number} endTime - 结束时间
   * @param {boolean} success - 是否成功
   */
  recordApiCallTime(startTime, endTime, success = true) {
    const callTime = endTime - startTime;
    this.metrics.apiCallTimes.push({
      callTime,
      success,
      timestamp: Date.now(),
    });

    // 保持最近100条记录
    if (this.metrics.apiCallTimes.length > 100) {
      this.metrics.apiCallTimes.shift();
    }

    console.log("记录API调用时间:", {
      callTime: callTime.toFixed(2) + "ms",
      success,
    });
  }

  /**
   * 记录缓存命中
   * @param {boolean} hit - 是否命中
   */
  recordCacheHit(hit) {
    if (hit) {
      this.metrics.cacheHitRate.hits++;
    } else {
      this.metrics.cacheHitRate.misses++;
    }
  }

  /**
   * 记录用户交互
   * @param {PerformanceEventTiming} entry - 性能条目
   */
  recordUserInteraction(entry) {
    this.metrics.userInteractions.push({
      type: entry.name,
      duration: entry.duration,
      timestamp: Date.now(),
    });

    // 保持最近50条记录
    if (this.metrics.userInteractions.length > 50) {
      this.metrics.userInteractions.shift();
    }
  }

  /**
   * 记录内存使用情况
   * @param {number} memoryUsage - 内存使用量
   */
  recordMemoryUsage(memoryUsage) {
    this.metrics.memoryUsage.push({
      usage: memoryUsage,
      timestamp: Date.now(),
    });

    // 保持最近50条记录
    if (this.metrics.memoryUsage.length > 50) {
      this.metrics.memoryUsage.shift();
    }
  }

  /**
   * 记录错误
   * @param {Error} error - 错误对象
   * @param {string} context - 错误上下文
   */
  recordError(error, context = "unknown") {
    this.metrics.errors.push({
      message: error.message,
      context,
      timestamp: Date.now(),
    });

    // 保持最近20条记录
    if (this.metrics.errors.length > 20) {
      this.metrics.errors.shift();
    }
  }

  /**
   * 获取性能统计报告
   * @returns {Object} 性能报告
   */
  getPerformanceReport() {
    const now = performance.now();
    const uptime = now - this.startTime;

    // 计算平均图片加载时间
    const avgImageLoadTime =
      this.metrics.imageLoadTimes.length > 0
        ? this.metrics.imageLoadTimes.reduce(
            (sum, item) => sum + item.loadTime,
            0
          ) / this.metrics.imageLoadTimes.length
        : 0;

    // 计算平均API调用时间
    const avgApiCallTime =
      this.metrics.apiCallTimes.length > 0
        ? this.metrics.apiCallTimes.reduce(
            (sum, item) => sum + item.callTime,
            0
          ) / this.metrics.apiCallTimes.length
        : 0;

    // 计算缓存命中率
    const totalCacheRequests =
      this.metrics.cacheHitRate.hits + this.metrics.cacheHitRate.misses;
    const cacheHitRate =
      totalCacheRequests > 0
        ? ((this.metrics.cacheHitRate.hits / totalCacheRequests) * 100).toFixed(
            2
          )
        : 0;

    // 获取内存使用情况
    const memoryInfo = this.getMemoryInfo();

    return {
      uptime: uptime.toFixed(2),
      imageLoadTimes: {
        average: avgImageLoadTime.toFixed(2),
        count: this.metrics.imageLoadTimes.length,
        recent: this.metrics.imageLoadTimes.slice(-5),
      },
      apiCallTimes: {
        average: avgApiCallTime.toFixed(2),
        count: this.metrics.apiCallTimes.length,
        recent: this.metrics.apiCallTimes.slice(-5),
      },
      cachePerformance: {
        hitRate: cacheHitRate + "%",
        hits: this.metrics.cacheHitRate.hits,
        misses: this.metrics.cacheHitRate.misses,
      },
      memoryUsage: memoryInfo,
      userInteractions: {
        count: this.metrics.userInteractions.length,
        recent: this.metrics.userInteractions.slice(-5),
      },
      errors: {
        count: this.metrics.errors.length,
        recent: this.metrics.errors.slice(-3),
      },
    };
  }

  /**
   * 获取内存信息
   * @returns {Object} 内存信息
   */
  getMemoryInfo() {
    if ("memory" in performance) {
      return {
        used:
          (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + "MB",
        total:
          (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + "MB",
        limit:
          (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + "MB",
      };
    }
    return { message: "浏览器不支持内存信息获取" };
  }

  /**
   * 输出性能报告到控制台
   */
  logPerformanceReport() {
    const report = this.getPerformanceReport();
    console.group("📊 性能监控报告");
    console.log("运行时间:", report.uptime + "ms");
    console.log("图片加载:", report.imageLoadTimes);
    console.log("API调用:", report.apiCallTimes);
    console.log("缓存性能:", report.cachePerformance);
    console.log("内存使用:", report.memoryUsage);
    console.log("用户交互:", report.userInteractions);
    console.log("错误统计:", report.errors);
    console.groupEnd();
  }

  /**
   * 清理监控数据
   */
  cleanup() {
    this.metrics = {
      imageLoadTimes: [],
      apiCallTimes: [],
      cacheHitRate: { hits: 0, misses: 0 },
      memoryUsage: [],
      userInteractions: [],
      errors: [],
    };
    console.log("性能监控数据已清理");
  }
}

/**
 * 事件处理优化器
 */
class EventOptimizer {
  constructor() {
    this.eventListeners = new Map();
    this.throttleTimers = new Map();
    this.debounceTimers = new Map();

    console.log("EventOptimizer 初始化完成");
  }

  /**
   * 优化的事件监听器添加
   * @param {EventTarget} target - 事件目标
   * @param {string} type - 事件类型
   * @param {Function} listener - 事件监听器
   * @param {Object} options - 选项
   */
  addEventListener(target, type, listener, options = {}) {
    const key = this.getEventKey(target, type);

    // 使用被动监听器优化性能
    const optimizedOptions = {
      passive: options.passive !== false,
      capture: options.capture || false,
      once: options.once || false,
    };

    // 包装监听器以添加性能监控
    const wrappedListener = this.wrapListener(listener, type);

    target.addEventListener(type, wrappedListener, optimizedOptions);

    // 记录监听器
    if (!this.eventListeners.has(key)) {
      this.eventListeners.set(key, []);
    }
    this.eventListeners.get(key).push({
      listener: wrappedListener,
      originalListener: listener,
      options: optimizedOptions,
    });

    console.log("添加优化事件监听器:", {
      type,
      passive: optimizedOptions.passive,
    });
  }

  /**
   * 移除事件监听器
   * @param {EventTarget} target - 事件目标
   * @param {string} type - 事件类型
   * @param {Function} listener - 原始监听器
   */
  removeEventListener(target, type, listener) {
    const key = this.getEventKey(target, type);
    const listeners = this.eventListeners.get(key);

    if (listeners) {
      const index = listeners.findIndex(
        (item) => item.originalListener === listener
      );
      if (index !== -1) {
        const listenerInfo = listeners[index];
        target.removeEventListener(
          type,
          listenerInfo.listener,
          listenerInfo.options
        );
        listeners.splice(index, 1);

        if (listeners.length === 0) {
          this.eventListeners.delete(key);
        }
      }
    }
  }

  /**
   * 包装监听器以添加性能监控
   * @param {Function} listener - 原始监听器
   * @param {string} eventType - 事件类型
   * @returns {Function} 包装后的监听器
   */
  wrapListener(listener, eventType) {
    return (event) => {
      const startTime = performance.now();

      try {
        listener(event);
      } catch (error) {
        console.error(`事件监听器执行错误 (${eventType}):`, error);
      } finally {
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        // 如果执行时间过长，发出警告
        if (executionTime > 16) {
          // 16ms 约等于 60fps
          console.warn(
            `事件监听器执行时间过长 (${eventType}): ${executionTime.toFixed(
              2
            )}ms`
          );
        }
      }
    };
  }

  /**
   * 创建节流函数
   * @param {Function} func - 要节流的函数
   * @param {number} delay - 节流延迟
   * @param {string} key - 节流键
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay, key = "default") {
    return (...args) => {
      if (!this.throttleTimers.has(key)) {
        func.apply(this, args);
        this.throttleTimers.set(
          key,
          setTimeout(() => {
            this.throttleTimers.delete(key);
          }, delay)
        );
      }
    };
  }

  /**
   * 创建防抖函数
   * @param {Function} func - 要防抖的函数
   * @param {number} delay - 防抖延迟
   * @param {string} key - 防抖键
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay, key = "default") {
    return (...args) => {
      if (this.debounceTimers.has(key)) {
        clearTimeout(this.debounceTimers.get(key));
      }

      this.debounceTimers.set(
        key,
        setTimeout(() => {
          func.apply(this, args);
          this.debounceTimers.delete(key);
        }, delay)
      );
    };
  }

  /**
   * 获取事件键
   * @param {EventTarget} target - 事件目标
   * @param {string} type - 事件类型
   * @returns {string} 事件键
   */
  getEventKey(target, type) {
    return `${target.constructor.name}_${type}`;
  }

  /**
   * 清理所有定时器和监听器
   */
  cleanup() {
    // 清理节流定时器
    for (const timer of this.throttleTimers.values()) {
      clearTimeout(timer);
    }
    this.throttleTimers.clear();

    // 清理防抖定时器
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // 清理事件监听器记录
    this.eventListeners.clear();

    console.log("EventOptimizer 已清理");
  }
}

/**
 * 增强的预加载策略管理器
 * 提供更智能的预加载机制和性能优化
 */
class EnhancedPreloadStrategy extends PreloadStrategy {
  constructor(apiService, imageCache, options = {}) {
    super(apiService, imageCache, options);

    // 增强配置
    this.adaptiveThreshold = options.adaptiveThreshold || 0.7; // 缓存命中率阈值
    this.maxPreloadCount = options.maxPreloadCount || 8; // 最大预加载数量
    this.minPreloadCount = options.minPreloadCount || 2; // 最小预加载数量
    this.priorityUrls = new Set(options.priorityUrls || []); // 优先预加载URL
    this.performanceMonitor = options.performanceMonitor; // 性能监控器
    this.imageViewer = options.imageViewer; // ImageViewer实例，用于访问队列

    // 统计信息
    this.stats = {
      totalPreloaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      adaptiveAdjustments: 0,
      priorityPreloads: 0,
      autoPreloads: 0,
    };

    // 自适应参数
    this.lastOptimizeTime = Date.now();
    this.optimizeInterval = options.optimizeInterval || 30000; // 30秒优化一次

    console.log("EnhancedPreloadStrategy 初始化完成", {
      preloadCount: this.preloadCount,
      adaptiveThreshold: this.adaptiveThreshold,
      maxPreloadCount: this.maxPreloadCount,
    });
  }

  /**
   * 图片加载完成后自动预加载
   * @param {string} currentImageUrl - 当前加载完成的图片URL
   */
  async preloadOnImageLoad(currentImageUrl) {
    try {
      console.log("触发图片加载后预加载:", currentImageUrl);
      this.stats.autoPreloads++;

      // 记录当前图片为已预加载
      this.preloadedUrls.add(currentImageUrl);

      // 检查是否需要补充预加载
      const cacheStats = this.imageCache.getStats();
      const availableSlots = this.preloadCount - cacheStats.cacheSize;

      if (availableSlots > 0 && !this.isPreloading) {
        console.log(`需要补充预加载 ${availableSlots} 张图片`);
        await this.preloadBatch(Math.min(availableSlots, 2)); // 一次最多补充2张
      }

      // 触发自适应优化
      await this.adaptivePreload();
    } catch (error) {
      console.error("图片加载后预加载失败:", error);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "preloadOnImageLoad");
      }
    }
  }

  /**
   * 自适应预加载策略
   * 根据缓存命中率和性能指标动态调整预加载参数
   */
  async adaptivePreload() {
    try {
      const now = Date.now();

      // 检查是否到了优化时间
      if (now - this.lastOptimizeTime < this.optimizeInterval) {
        return;
      }

      this.lastOptimizeTime = now;

      // 获取缓存统计
      const cacheStats = this.imageCache.getStats();
      const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
      const hitRate =
        totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;

      console.log("执行自适应预加载优化", {
        hitRate: (hitRate * 100).toFixed(2) + "%",
        currentPreloadCount: this.preloadCount,
        cacheUsage: cacheStats.memoryUsagePercent + "%",
      });

      // 根据命中率调整预加载数量
      if (
        hitRate < this.adaptiveThreshold &&
        this.preloadCount < this.maxPreloadCount
      ) {
        // 命中率低，增加预加载数量
        this.preloadCount = Math.min(
          this.preloadCount + 1,
          this.maxPreloadCount
        );
        this.stats.adaptiveAdjustments++;
        console.log("增加预加载数量至:", this.preloadCount);

        // 立即预加载更多图片
        await this.preloadBatch(1);
      } else if (hitRate > 0.9 && this.preloadCount > this.minPreloadCount) {
        // 命中率很高，可以减少预加载数量以节省资源
        this.preloadCount = Math.max(
          this.preloadCount - 1,
          this.minPreloadCount
        );
        this.stats.adaptiveAdjustments++;
        console.log("减少预加载数量至:", this.preloadCount);
      }

      // 检查内存使用情况
      if (parseFloat(cacheStats.memoryUsagePercent) > 80) {
        console.log("内存使用率过高，暂停预加载");
        return;
      }

      // 如果性能监控器可用，根据性能指标调整
      if (this.performanceMonitor) {
        const report = this.performanceMonitor.getPerformanceReport();
        const avgLoadTime = parseFloat(report.imageLoadTimes.average);

        // 如果图片加载时间过长，增加预加载以改善用户体验
        if (avgLoadTime > 2000 && this.preloadCount < this.maxPreloadCount) {
          this.preloadCount++;
          console.log("图片加载较慢，增加预加载数量至:", this.preloadCount);
        }
      }
    } catch (error) {
      console.error("自适应预加载失败:", error);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "adaptivePreload");
      }
    }
  }

  /**
   * 优先预加载指定URL列表
   * @param {string[]} urls - 优先预加载的URL列表
   */
  async priorityPreload(urls) {
    if (!urls || urls.length === 0) {
      return;
    }

    try {
      console.log("开始优先预加载:", urls.length, "张图片");
      this.stats.priorityPreloads += urls.length;

      // 将URL添加到优先集合
      urls.forEach((url) => this.priorityUrls.add(url));

      // 并行预加载优先图片
      const preloadPromises = urls.map(async (url) => {
        try {
          // 检查是否已缓存
          if (this.imageCache.cache.has(url)) {
            console.log("优先图片已缓存:", url);
            // 即使已缓存，也要添加到队列
            if (
              this.imageViewer &&
              typeof this.imageViewer.addToQueue === "function"
            ) {
              this.imageViewer.addToQueue(url);
            }
            return;
          }

          await this.imageCache.preloadSingle(url);
          this.preloadedUrls.add(url);

          // 将预加载的URL添加到队列中
          if (
            this.imageViewer &&
            typeof this.imageViewer.addToQueue === "function"
          ) {
            this.imageViewer.addToQueue(url);
          }

          console.log("优先预加载完成:", url);
        } catch (error) {
          console.warn("优先预加载失败:", url, error);
        }
      });

      await Promise.allSettled(preloadPromises);
      console.log("优先预加载批次完成");
    } catch (error) {
      console.error("优先预加载执行失败:", error);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "priorityPreload");
      }
    }
  }

  /**
   * 批量预加载指定数量的图片
   * @param {number} count - 预加载数量
   */
  async preloadBatch(count) {
    if (this.isPreloading || count <= 0) {
      return;
    }

    this.isPreloading = true;

    try {
      console.log("开始批量预加载:", count, "张图片");

      for (let i = 0; i < count; i++) {
        await this.preloadNext();

        // 添加小延迟避免过于频繁的API调用
        if (i < count - 1) {
          await this.delay(this.preloadDelay / 2); // 批量预加载使用更短的延迟
        }
      }
    } catch (error) {
      console.error("批量预加载失败:", error);
    } finally {
      this.isPreloading = false;
    }
  }

  /**
   * 智能预加载 - 增强版本
   * @param {string} currentImageUrl - 当前显示的图片URL
   */
  async smartPreload(currentImageUrl) {
    try {
      // 记录缓存命中/未命中
      if (this.imageCache.cache.has(currentImageUrl)) {
        this.stats.cacheHits++;
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(true);
        }
      } else {
        this.stats.cacheMisses++;
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(false);
        }
      }

      // 如果正在预加载，跳过
      if (this.isPreloading) {
        return;
      }

      // 检查队列状态，如果队列较空则补充预加载
      if (
        this.imageViewer &&
        typeof this.imageViewer.getQueueStatus === "function"
      ) {
        const queueStatus = this.imageViewer.getQueueStatus();
        const shouldPreload = queueStatus.length < this.preloadCount / 2; // 队列少于一半时补充

        if (shouldPreload) {
          console.log("队列较空，触发智能预加载补充");
          await this.preloadBatch(
            Math.min(2, this.preloadCount - queueStatus.length)
          );
        }
      } else {
        // 回退到原有逻辑
        const cacheStats = this.imageCache.getStats();
        const shouldPreload = cacheStats.cacheSize < this.preloadCount;

        if (shouldPreload) {
          console.log("触发智能预加载");
          await this.startPreloading();
        }
      }

      // 定期执行自适应优化
      await this.adaptivePreload();
    } catch (error) {
      console.error("智能预加载失败:", error);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "smartPreload");
      }
    }
  }

  /**
   * 获取预加载统计信息
   * @returns {Object} 预加载统计
   */
  getPreloadStats() {
    const cacheStats = this.imageCache.getStats();
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate =
      totalRequests > 0
        ? ((this.stats.cacheHits / totalRequests) * 100).toFixed(2)
        : "0.00";

    return {
      // 基础统计
      totalPreloaded: this.stats.totalPreloaded,
      currentPreloadCount: this.preloadCount,
      preloadedUrls: this.preloadedUrls.size,

      // 缓存统计
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      hitRate: hitRate + "%",

      // 缓存状态
      cacheSize: cacheStats.cacheSize,
      maxCacheSize: cacheStats.maxCacheSize,
      memoryUsage: cacheStats.memoryUsage,
      memoryUsagePercent: cacheStats.memoryUsagePercent + "%",

      // 增强功能统计
      adaptiveAdjustments: this.stats.adaptiveAdjustments,
      priorityPreloads: this.stats.priorityPreloads,
      autoPreloads: this.stats.autoPreloads,
      priorityUrlsCount: this.priorityUrls.size,

      // 配置信息
      adaptiveThreshold: this.adaptiveThreshold,
      maxPreloadCount: this.maxPreloadCount,
      minPreloadCount: this.minPreloadCount,

      // 状态信息
      isPreloading: this.isPreloading,
      lastOptimizeTime: new Date(this.lastOptimizeTime).toLocaleTimeString(),
    };
  }

  /**
   * 优化预加载数量
   * 根据当前性能和使用情况动态调整
   */
  optimizePreloadCount() {
    try {
      const stats = this.getPreloadStats();
      const hitRate = parseFloat(stats.hitRate);
      const memoryUsage = parseFloat(stats.memoryUsagePercent);

      console.log("执行预加载数量优化", {
        currentCount: this.preloadCount,
        hitRate: stats.hitRate,
        memoryUsage: stats.memoryUsagePercent,
      });

      // 基于命中率和内存使用情况优化
      if (
        hitRate < 50 &&
        memoryUsage < 70 &&
        this.preloadCount < this.maxPreloadCount
      ) {
        // 命中率低且内存充足，增加预加载
        this.preloadCount = Math.min(
          this.preloadCount + 2,
          this.maxPreloadCount
        );
        console.log("优化：增加预加载数量至", this.preloadCount);
      } else if (hitRate > 90 || memoryUsage > 85) {
        // 命中率很高或内存不足，减少预加载
        this.preloadCount = Math.max(
          this.preloadCount - 1,
          this.minPreloadCount
        );
        console.log("优化：减少预加载数量至", this.preloadCount);
      }

      this.stats.adaptiveAdjustments++;
    } catch (error) {
      console.error("预加载数量优化失败:", error);
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "optimizePreloadCount");
      }
    }
  }

  /**
   * 重写预加载下一张图片方法，增加统计
   */
  async preloadNext() {
    try {
      await super.preloadNext();
      this.stats.totalPreloaded++;
    } catch (error) {
      console.warn("预加载下一张图片失败:", error);
      throw error;
    }
  }

  /**
   * 清理增强预加载状态
   */
  cleanup() {
    super.cleanup();

    // 清理增强功能的状态
    this.priorityUrls.clear();
    this.stats = {
      totalPreloaded: 0,
      cacheHits: 0,
      cacheMisses: 0,
      adaptiveAdjustments: 0,
      priorityPreloads: 0,
      autoPreloads: 0,
    };

    console.log("EnhancedPreloadStrategy 已清理");
  }

  /**
   * 输出详细的预加载报告
   */
  logPreloadReport() {
    const stats = this.getPreloadStats();

    console.group("🚀 增强预加载策略报告");
    console.log("预加载统计:", {
      总预加载数: stats.totalPreloaded,
      当前预加载数量: stats.currentPreloadCount,
      已预加载URL数: stats.preloadedUrls,
    });
    console.log("缓存性能:", {
      命中次数: stats.cacheHits,
      未命中次数: stats.cacheMisses,
      命中率: stats.hitRate,
    });
    console.log("缓存状态:", {
      当前大小: stats.cacheSize,
      最大大小: stats.maxCacheSize,
      内存使用: stats.memoryUsagePercent,
    });
    console.log("增强功能:", {
      自适应调整次数: stats.adaptiveAdjustments,
      优先预加载次数: stats.priorityPreloads,
      自动预加载次数: stats.autoPreloads,
      优先URL数量: stats.priorityUrlsCount,
    });
    console.log("配置信息:", {
      自适应阈值: stats.adaptiveThreshold,
      最大预加载数: stats.maxPreloadCount,
      最小预加载数: stats.minPreloadCount,
    });
    console.log("状态:", {
      正在预加载: stats.isPreloading,
      上次优化时间: stats.lastOptimizeTime,
    });
    console.groupEnd();
  }
}

// 导出类
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    ImageCache,
    PreloadStrategy,
    EnhancedPreloadStrategy,
    PerformanceMonitor,
    EventOptimizer,
  };
}
