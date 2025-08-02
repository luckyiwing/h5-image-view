/**
 * 用户引导错误处理器 - 为引导功能提供错误处理和降级方案
 * 
 * 功能特性:
 * - 为所有新组件添加错误处理机制
 * - 实现功能失败时的优雅降级
 * - 添加错误日志记录和监控
 * - 确保核心功能不受引导功能影响
 */

/**
 * 基础错误处理器类
 */
class BaseErrorHandler {
    constructor(componentName) {
        this.componentName = componentName;
        this.errorCount = 0;
        this.maxErrors = 10; // 最大错误次数
        this.errorLog = [];
        this.isDisabled = false;
        
        console.log(`${componentName} 错误处理器已初始化`);
    }

    /**
     * 记录错误
     * @param {string} operation - 操作名称
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     */
    logError(operation, error, context = {}) {
        this.errorCount++;
        
        const errorEntry = {
            timestamp: new Date().toISOString(),
            component: this.componentName,
            operation: operation,
            message: error.message,
            stack: error.stack,
            context: context,
            errorCount: this.errorCount
        };
        
        this.errorLog.push(errorEntry);
        
        // 保持错误日志在合理大小
        if (this.errorLog.length > 50) {
            this.errorLog.shift();
        }
        
        console.error(`[${this.componentName}] ${operation} 失败:`, error.message, context);
        
        // 如果错误次数过多，禁用组件
        if (this.errorCount >= this.maxErrors) {
            this.disableComponent();
        }
    }

    /**
     * 禁用组件
     */
    disableComponent() {
        this.isDisabled = true;
        console.warn(`[${this.componentName}] 错误次数过多，组件已禁用`);
    }

    /**
     * 检查组件是否可用
     * @returns {boolean} 是否可用
     */
    isComponentAvailable() {
        return !this.isDisabled;
    }

    /**
     * 重置错误计数
     */
    resetErrorCount() {
        this.errorCount = 0;
        this.isDisabled = false;
        console.log(`[${this.componentName}] 错误计数已重置`);
    }

    /**
     * 获取错误统计
     * @returns {Object} 错误统计信息
     */
    getErrorStats() {
        return {
            component: this.componentName,
            errorCount: this.errorCount,
            isDisabled: this.isDisabled,
            recentErrors: this.errorLog.slice(-5)
        };
    }
}

/**
 * 引导功能错误处理器
 */
class GuideErrorHandler extends BaseErrorHandler {
    constructor() {
        super('UserGuideManager');
        this.fallbackContent = this.createFallbackContent();
    }

    /**
     * 创建降级内容
     * @returns {Object} 降级内容
     */
    createFallbackContent() {
        return {
            title: '操作指南',
            subtitle: '基本操作说明',
            instructions: [
                {
                    action: '图片切换',
                    description: '使用鼠标滚轮或键盘方向键切换图片',
                    icon: '📖'
                }
            ],
            tips: ['如遇问题请刷新页面重试'],
            layout: {
                maxWidth: '400px',
                fontSize: '14px'
            }
        };
    }

    /**
     * 处理存储错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否使用降级方案
     */
    handleStorageError(error) {
        this.logError('localStorage操作', error);
        
        // 使用内存存储作为降级方案
        console.warn('localStorage不可用，使用内存存储');
        return true;
    }

    /**
     * 处理渲染错误
     * @param {Error} error - 错误对象
     * @returns {Object} 降级内容
     */
    handleRenderError(error) {
        this.logError('界面渲染', error);
        
        // 返回简化的降级内容
        return this.fallbackContent;
    }

    /**
     * 处理设备检测错误
     * @param {Error} error - 错误对象
     * @returns {string} 默认设备类型
     */
    handleDeviceDetectionError(error) {
        this.logError('设备检测', error);
        
        // 返回默认设备类型
        return 'desktop';
    }

    /**
     * 处理内容加载错误
     * @param {Error} error - 错误对象
     * @param {string} deviceType - 设备类型
     * @returns {Object} 降级内容
     */
    handleContentLoadError(error, deviceType) {
        this.logError('内容加载', error, { deviceType });
        
        // 返回设备特定的降级内容
        const fallback = { ...this.fallbackContent };
        
        if (deviceType === 'mobile') {
            fallback.instructions[0].description = '上下滑动切换图片';
        } else if (deviceType === 'tablet') {
            fallback.instructions[0].description = '上下滑动或使用键盘方向键切换图片';
        }
        
        return fallback;
    }
}

/**
 * 动画错误处理器
 */
class AnimationErrorHandler extends BaseErrorHandler {
    constructor() {
        super('AnimationController');
        this.performanceThreshold = 16; // 16ms per frame (60fps)
        this.fallbackMode = false;
    }

    /**
     * 处理动画失败
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否启用降级模式
     */
    handleAnimationFailure(error) {
        this.logError('动画执行', error);
        
        // 启用降级模式：禁用动画，使用即时切换
        this.fallbackMode = true;
        console.warn('动画功能异常，已切换到即时切换模式');
        
        return true;
    }

    /**
     * 处理性能问题
     * @param {Object} metrics - 性能指标
     * @returns {Object} 优化建议
     */
    handlePerformanceIssue(metrics) {
        this.logError('动画性能', new Error('性能不佳'), metrics);
        
        const suggestions = {
            disableHardwareAcceleration: false,
            increaseDuration: false,
            simplifyEasing: false,
            disableAnimation: false
        };
        
        // 根据性能指标提供优化建议
        if (metrics.droppedFrames > 10) {
            suggestions.disableHardwareAcceleration = true;
            suggestions.increaseDuration = true;
        }
        
        if (metrics.averageFrameTime > this.performanceThreshold * 2) {
            suggestions.simplifyEasing = true;
        }
        
        if (metrics.averageFrameTime > this.performanceThreshold * 4) {
            suggestions.disableAnimation = true;
            this.fallbackMode = true;
        }
        
        return suggestions;
    }

    /**
     * 处理浏览器兼容性问题
     * @param {Error} error - 错误对象
     * @returns {Object} 兼容性配置
     */
    handleCompatibilityIssue(error) {
        this.logError('浏览器兼容性', error);
        
        // 返回兼容性配置
        return {
            useTransform: false,
            useTransition: false,
            useRequestAnimationFrame: false,
            fallbackToSetTimeout: true
        };
    }

    /**
     * 检查是否应该使用降级模式
     * @returns {boolean} 是否使用降级模式
     */
    shouldUseFallbackMode() {
        return this.fallbackMode || this.isDisabled;
    }
}

/**
 * 预加载错误处理器
 */
class PreloadErrorHandler extends BaseErrorHandler {
    constructor() {
        super('PreloadStrategy');
        this.failedUrls = new Set();
        this.retryCount = new Map();
        this.maxRetries = 3;
    }

    /**
     * 处理预加载失败
     * @param {string} url - 图片URL
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否应该重试
     */
    handlePreloadFailure(url, error) {
        this.logError('预加载失败', error, { url });
        
        // 记录失败的URL
        this.failedUrls.add(url);
        
        // 更新重试次数
        const currentRetries = this.retryCount.get(url) || 0;
        this.retryCount.set(url, currentRetries + 1);
        
        // 判断是否应该重试
        const shouldRetry = currentRetries < this.maxRetries;
        
        if (!shouldRetry) {
            console.warn(`预加载 ${url} 达到最大重试次数，放弃预加载`);
        }
        
        return shouldRetry;
    }

    /**
     * 处理缓存溢出
     * @param {Object} cacheInfo - 缓存信息
     * @returns {Array} 需要清理的URL列表
     */
    handleCacheOverflow(cacheInfo) {
        this.logError('缓存溢出', new Error('缓存空间不足'), cacheInfo);
        
        // 返回需要清理的URL（最旧的一半）
        const urlsToClean = [];
        const totalUrls = cacheInfo.cachedUrls?.length || 0;
        const cleanCount = Math.floor(totalUrls / 2);
        
        if (cacheInfo.cachedUrls) {
            urlsToClean.push(...cacheInfo.cachedUrls.slice(0, cleanCount));
        }
        
        console.log(`缓存溢出，将清理 ${cleanCount} 个缓存项`);
        return urlsToClean;
    }

    /**
     * 处理网络错误
     * @param {Error} error - 网络错误
     * @returns {Object} 网络策略调整
     */
    handleNetworkError(error) {
        this.logError('网络错误', error);
        
        // 返回网络策略调整建议
        return {
            reducePreloadCount: true,
            increaseTimeout: true,
            enableRetry: true,
            delayNextPreload: 2000 // 延迟2秒
        };
    }

    /**
     * 检查URL是否应该跳过预加载
     * @param {string} url - 图片URL
     * @returns {boolean} 是否跳过
     */
    shouldSkipPreload(url) {
        return this.failedUrls.has(url) && 
               (this.retryCount.get(url) || 0) >= this.maxRetries;
    }

    /**
     * 重置URL的失败状态
     * @param {string} url - 图片URL
     */
    resetUrlFailureStatus(url) {
        this.failedUrls.delete(url);
        this.retryCount.delete(url);
    }
}

/**
 * 响应式管理错误处理器
 */
class ResponsiveErrorHandler extends BaseErrorHandler {
    constructor() {
        super('ResponsiveManager');
        this.defaultDeviceInfo = {
            deviceType: 'desktop',
            screenWidth: 1920,
            screenHeight: 1080,
            orientation: 'landscape',
            touchSupported: false
        };
    }

    /**
     * 处理设备检测错误
     * @param {Error} error - 错误对象
     * @returns {Object} 默认设备信息
     */
    handleDeviceDetectionError(error) {
        this.logError('设备检测', error);
        
        // 返回默认设备信息
        return { ...this.defaultDeviceInfo };
    }

    /**
     * 处理尺寸计算错误
     * @param {Error} error - 错误对象
     * @returns {Object} 默认尺寸信息
     */
    handleSizeCalculationError(error) {
        this.logError('尺寸计算', error);
        
        // 返回安全的默认尺寸
        return {
            width: Math.min(window.innerWidth || 1920, 1920),
            height: Math.min(window.innerHeight || 1080, 1080)
        };
    }

    /**
     * 处理事件监听错误
     * @param {Error} error - 错误对象
     * @param {string} eventType - 事件类型
     * @returns {boolean} 是否使用轮询替代
     */
    handleEventListenerError(error, eventType) {
        this.logError('事件监听', error, { eventType });
        
        // 对于关键事件，建议使用轮询替代
        const criticalEvents = ['resize', 'orientationchange'];
        return criticalEvents.includes(eventType);
    }
}

/**
 * 全局错误监控器
 */
class GlobalErrorMonitor {
    constructor() {
        this.handlers = new Map();
        this.globalErrorCount = 0;
        this.isMonitoring = false;
        
        this.initializeGlobalErrorHandling();
    }

    /**
     * 初始化全局错误处理
     */
    initializeGlobalErrorHandling() {
        // 监听未捕获的错误
        window.addEventListener('error', (event) => {
            this.handleGlobalError(event.error, 'uncaught', {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno
            });
        });

        // 监听未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handleGlobalError(event.reason, 'unhandled-promise', {
                promise: event.promise
            });
        });

        this.isMonitoring = true;
        console.log('全局错误监控已启动');
    }

    /**
     * 注册错误处理器
     * @param {string} name - 处理器名称
     * @param {BaseErrorHandler} handler - 错误处理器实例
     */
    registerHandler(name, handler) {
        this.handlers.set(name, handler);
        console.log(`错误处理器 ${name} 已注册`);
    }

    /**
     * 处理全局错误
     * @param {Error} error - 错误对象
     * @param {string} type - 错误类型
     * @param {Object} context - 上下文信息
     */
    handleGlobalError(error, type, context = {}) {
        this.globalErrorCount++;
        
        console.error(`[全局错误 #${this.globalErrorCount}] ${type}:`, error, context);
        
        // 检查是否是引导相关的错误
        const errorMessage = error?.message || '';
        const errorStack = error?.stack || '';
        
        if (this.isGuideRelatedError(errorMessage, errorStack)) {
            // 尝试优雅降级
            this.handleGuideError(error, context);
        }
    }

    /**
     * 检查是否是引导相关错误
     * @param {string} message - 错误消息
     * @param {string} stack - 错误堆栈
     * @returns {boolean} 是否是引导相关错误
     */
    isGuideRelatedError(message, stack) {
        const guideKeywords = [
            'UserGuideManager',
            'GuideOverlay',
            'guide-overlay',
            'LocalStorageManager',
            'GuideContentConfig'
        ];
        
        return guideKeywords.some(keyword => 
            message.includes(keyword) || stack.includes(keyword)
        );
    }

    /**
     * 处理引导相关错误
     * @param {Error} error - 错误对象
     * @param {Object} context - 上下文信息
     */
    handleGuideError(error, context) {
        console.warn('检测到引导功能错误，尝试降级处理');
        
        // 隐藏可能存在的引导界面
        const overlay = document.querySelector('.guide-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
        
        // 通知用户（如果UI控制器可用）
        if (window.imageViewer?.uiController) {
            window.imageViewer.uiController.showUserFeedback(
                '引导功能暂时不可用', 
                3000
            );
        }
    }

    /**
     * 获取全局错误统计
     * @returns {Object} 错误统计信息
     */
    getGlobalErrorStats() {
        const handlerStats = {};
        
        this.handlers.forEach((handler, name) => {
            handlerStats[name] = handler.getErrorStats();
        });
        
        return {
            globalErrorCount: this.globalErrorCount,
            isMonitoring: this.isMonitoring,
            handlers: handlerStats
        };
    }

    /**
     * 重置所有错误计数
     */
    resetAllErrorCounts() {
        this.globalErrorCount = 0;
        
        this.handlers.forEach(handler => {
            handler.resetErrorCount();
        });
        
        console.log('所有错误计数已重置');
    }

    /**
     * 销毁错误监控器
     */
    destroy() {
        this.handlers.clear();
        this.isMonitoring = false;
        console.log('全局错误监控器已销毁');
    }
}

// 创建全局实例
const globalErrorMonitor = new GlobalErrorMonitor();

// 创建各个错误处理器实例
const guideErrorHandler = new GuideErrorHandler();
const animationErrorHandler = new AnimationErrorHandler();
const preloadErrorHandler = new PreloadErrorHandler();
const responsiveErrorHandler = new ResponsiveErrorHandler();

// 注册错误处理器
globalErrorMonitor.registerHandler('guide', guideErrorHandler);
globalErrorMonitor.registerHandler('animation', animationErrorHandler);
globalErrorMonitor.registerHandler('preload', preloadErrorHandler);
globalErrorMonitor.registerHandler('responsive', responsiveErrorHandler);

// 导出到全局对象
if (typeof window !== 'undefined') {
    window.GuideErrorHandlers = {
        BaseErrorHandler,
        GuideErrorHandler,
        AnimationErrorHandler,
        PreloadErrorHandler,
        ResponsiveErrorHandler,
        GlobalErrorMonitor,
        // 实例
        globalErrorMonitor,
        guideErrorHandler,
        animationErrorHandler,
        preloadErrorHandler,
        responsiveErrorHandler
    };
}

// Node.js 环境导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BaseErrorHandler,
        GuideErrorHandler,
        AnimationErrorHandler,
        PreloadErrorHandler,
        ResponsiveErrorHandler,
        GlobalErrorMonitor
    };
}