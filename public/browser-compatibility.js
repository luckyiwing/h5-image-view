/**
 * 浏览器兼容性工具类
 * 提供跨浏览器兼容性检测和polyfill功能
 */
class BrowserCompatibility {
    constructor() {
        this.userAgent = navigator.userAgent.toLowerCase();
        this.features = this.detectFeatures();
        this.browserInfo = this.detectBrowser();
        this.initPolyfills();
    }

    /**
     * 检测浏览器特性支持情况
     * @returns {Object} 特性支持对象
     */
    detectFeatures() {
        return {
            // Fetch API支持
            fetch: typeof fetch !== 'undefined',
            
            // AbortController支持
            abortController: typeof AbortController !== 'undefined',
            
            // AbortSignal.timeout支持 (较新的API)
            abortSignalTimeout: typeof AbortSignal !== 'undefined' && 
                               typeof AbortSignal.timeout === 'function',
            
            // Promise支持
            promise: typeof Promise !== 'undefined',
            
            // 触摸事件支持
            touchEvents: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
            
            // 被动事件监听器支持
            passiveEvents: this.checkPassiveEventSupport(),
            
            // Performance API支持
            performance: typeof performance !== 'undefined' && 
                        typeof performance.now === 'function',
            
            // IntersectionObserver支持
            intersectionObserver: typeof IntersectionObserver !== 'undefined',
            
            // CSS Grid支持
            cssGrid: this.checkCSSGridSupport(),
            
            // CSS Flexbox支持
            cssFlexbox: this.checkCSSFlexboxSupport(),
            
            // 本地存储支持
            localStorage: this.checkLocalStorageSupport(),
            
            // 网络状态API支持
            networkStatus: 'onLine' in navigator,
            
            // 设备方向API支持
            deviceOrientation: 'orientation' in window || 'onorientationchange' in window
        };
    }

    /**
     * 检测浏览器信息
     * @returns {Object} 浏览器信息对象
     */
    detectBrowser() {
        const ua = this.userAgent;
        
        // 检测浏览器类型和版本
        let browser = 'unknown';
        let version = 'unknown';
        let engine = 'unknown';
        
        if (ua.includes('chrome') && !ua.includes('edg')) {
            browser = 'chrome';
            const match = ua.match(/chrome\/(\d+)/);
            version = match ? match[1] : 'unknown';
            engine = 'blink';
        } else if (ua.includes('firefox')) {
            browser = 'firefox';
            const match = ua.match(/firefox\/(\d+)/);
            version = match ? match[1] : 'unknown';
            engine = 'gecko';
        } else if (ua.includes('safari') && !ua.includes('chrome')) {
            browser = 'safari';
            const match = ua.match(/version\/(\d+)/);
            version = match ? match[1] : 'unknown';
            engine = 'webkit';
        } else if (ua.includes('edg')) {
            browser = 'edge';
            const match = ua.match(/edg\/(\d+)/);
            version = match ? match[1] : 'unknown';
            engine = 'blink';
        } else if (ua.includes('trident') || ua.includes('msie')) {
            browser = 'ie';
            const match = ua.match(/(?:msie |rv:)(\d+)/);
            version = match ? match[1] : 'unknown';
            engine = 'trident';
        }
        
        return {
            name: browser,
            version: parseInt(version) || 0,
            engine: engine,
            isMobile: /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua),
            isTablet: /ipad|android(?!.*mobile)|tablet/i.test(ua),
            isDesktop: !/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua)
        };
    }

    /**
     * 检测被动事件监听器支持
     * @returns {boolean} 是否支持被动事件监听器
     */
    checkPassiveEventSupport() {
        let passiveSupported = false;
        try {
            const options = {
                get passive() {
                    passiveSupported = true;
                    return false;
                }
            };
            window.addEventListener('test', null, options);
            window.removeEventListener('test', null, options);
        } catch (err) {
            passiveSupported = false;
        }
        return passiveSupported;
    }

    /**
     * 检测CSS Grid支持
     * @returns {boolean} 是否支持CSS Grid
     */
    checkCSSGridSupport() {
        return CSS.supports('display', 'grid');
    }

    /**
     * 检测CSS Flexbox支持
     * @returns {boolean} 是否支持CSS Flexbox
     */
    checkCSSFlexboxSupport() {
        return CSS.supports('display', 'flex');
    }

    /**
     * 检测本地存储支持
     * @returns {boolean} 是否支持本地存储
     */
    checkLocalStorageSupport() {
        try {
            const test = 'test';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * 初始化polyfills
     */
    initPolyfills() {
        // Fetch API polyfill
        if (!this.features.fetch) {
            this.polyfillFetch();
        }

        // AbortController polyfill
        if (!this.features.abortController) {
            this.polyfillAbortController();
        }

        // Performance.now polyfill
        if (!this.features.performance) {
            this.polyfillPerformanceNow();
        }

        // Promise polyfill (简单版本)
        if (!this.features.promise) {
            this.polyfillPromise();
        }
    }

    /**
     * Fetch API polyfill (简化版本)
     */
    polyfillFetch() {
        if (typeof XMLHttpRequest !== 'undefined') {
            window.fetch = function(url, options = {}) {
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    const method = options.method || 'GET';
                    
                    xhr.open(method, url);
                    
                    // 设置请求头
                    if (options.headers) {
                        Object.keys(options.headers).forEach(key => {
                            xhr.setRequestHeader(key, options.headers[key]);
                        });
                    }
                    
                    // 设置超时
                    if (options.timeout) {
                        xhr.timeout = options.timeout;
                    }
                    
                    xhr.onload = function() {
                        const response = {
                            ok: xhr.status >= 200 && xhr.status < 300,
                            status: xhr.status,
                            statusText: xhr.statusText,
                            json: function() {
                                return Promise.resolve(JSON.parse(xhr.responseText));
                            },
                            text: function() {
                                return Promise.resolve(xhr.responseText);
                            }
                        };
                        resolve(response);
                    };
                    
                    xhr.onerror = function() {
                        reject(new Error('Network request failed'));
                    };
                    
                    xhr.ontimeout = function() {
                        reject(new Error('Request timeout'));
                    };
                    
                    xhr.send(options.body);
                });
            };
        }
    }

    /**
     * AbortController polyfill (简化版本)
     */
    polyfillAbortController() {
        if (typeof AbortController === 'undefined') {
            window.AbortController = class {
                constructor() {
                    this.signal = {
                        aborted: false,
                        addEventListener: function() {},
                        removeEventListener: function() {}
                    };
                }
                
                abort() {
                    this.signal.aborted = true;
                }
            };
        }
    }

    /**
     * Performance.now polyfill
     */
    polyfillPerformanceNow() {
        if (typeof performance === 'undefined') {
            window.performance = {};
        }
        
        if (typeof performance.now === 'undefined') {
            performance.now = function() {
                return Date.now();
            };
        }
    }

    /**
     * Promise polyfill (非常简化的版本)
     */
    polyfillPromise() {
        if (typeof Promise === 'undefined') {
            window.Promise = class {
                constructor(executor) {
                    this.state = 'pending';
                    this.value = undefined;
                    this.handlers = [];
                    
                    const resolve = (value) => {
                        if (this.state === 'pending') {
                            this.state = 'fulfilled';
                            this.value = value;
                            this.handlers.forEach(handler => handler.onFulfilled(value));
                        }
                    };
                    
                    const reject = (reason) => {
                        if (this.state === 'pending') {
                            this.state = 'rejected';
                            this.value = reason;
                            this.handlers.forEach(handler => handler.onRejected(reason));
                        }
                    };
                    
                    try {
                        executor(resolve, reject);
                    } catch (error) {
                        reject(error);
                    }
                }
                
                then(onFulfilled, onRejected) {
                    return new Promise((resolve, reject) => {
                        const handler = {
                            onFulfilled: (value) => {
                                try {
                                    const result = onFulfilled ? onFulfilled(value) : value;
                                    resolve(result);
                                } catch (error) {
                                    reject(error);
                                }
                            },
                            onRejected: (reason) => {
                                try {
                                    const result = onRejected ? onRejected(reason) : reason;
                                    reject(result);
                                } catch (error) {
                                    reject(error);
                                }
                            }
                        };
                        
                        if (this.state === 'fulfilled') {
                            handler.onFulfilled(this.value);
                        } else if (this.state === 'rejected') {
                            handler.onRejected(this.value);
                        } else {
                            this.handlers.push(handler);
                        }
                    });
                }
                
                catch(onRejected) {
                    return this.then(null, onRejected);
                }
                
                static resolve(value) {
                    return new Promise(resolve => resolve(value));
                }
                
                static reject(reason) {
                    return new Promise((resolve, reject) => reject(reason));
                }
            };
        }
    }

    /**
     * 创建兼容的超时信号
     * @param {number} timeout - 超时时间（毫秒）
     * @returns {AbortSignal} 超时信号
     */
    createTimeoutSignal(timeout) {
        if (this.features.abortSignalTimeout) {
            return AbortSignal.timeout(timeout);
        }
        
        // 手动实现超时信号
        const controller = new AbortController();
        setTimeout(() => {
            controller.abort();
        }, timeout);
        
        return controller.signal;
    }

    /**
     * 添加兼容的事件监听器
     * @param {Element} element - 目标元素
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理器
     * @param {Object} options - 事件选项
     */
    addEventListener(element, event, handler, options = {}) {
        if (this.features.passiveEvents) {
            element.addEventListener(event, handler, options);
        } else {
            // 降级到简单的事件监听器
            element.addEventListener(event, handler, options.capture || false);
        }
    }

    /**
     * 移除兼容的事件监听器
     * @param {Element} element - 目标元素
     * @param {string} event - 事件名称
     * @param {Function} handler - 事件处理器
     * @param {Object} options - 事件选项
     */
    removeEventListener(element, event, handler, options = {}) {
        if (this.features.passiveEvents) {
            element.removeEventListener(event, handler, options);
        } else {
            element.removeEventListener(event, handler, options.capture || false);
        }
    }

    /**
     * 获取兼容的性能时间戳
     * @returns {number} 时间戳
     */
    now() {
        return this.features.performance ? performance.now() : Date.now();
    }

    /**
     * 检查特定特性是否支持
     * @param {string} feature - 特性名称
     * @returns {boolean} 是否支持
     */
    supports(feature) {
        return this.features[feature] || false;
    }

    /**
     * 获取浏览器信息
     * @returns {Object} 浏览器信息
     */
    getBrowserInfo() {
        return this.browserInfo;
    }

    /**
     * 获取所有特性支持情况
     * @returns {Object} 特性支持对象
     */
    getFeatures() {
        return this.features;
    }

    /**
     * 检查是否为旧版浏览器
     * @returns {boolean} 是否为旧版浏览器
     */
    isLegacyBrowser() {
        const browser = this.browserInfo;
        
        // 定义旧版浏览器的版本阈值
        const legacyVersions = {
            chrome: 60,
            firefox: 55,
            safari: 10,
            edge: 79,
            ie: Infinity // IE都算旧版
        };
        
        const threshold = legacyVersions[browser.name];
        return threshold !== undefined && browser.version < threshold;
    }

    /**
     * 获取兼容性报告
     * @returns {Object} 兼容性报告
     */
    getCompatibilityReport() {
        return {
            browser: this.browserInfo,
            features: this.features,
            isLegacy: this.isLegacyBrowser(),
            recommendations: this.getRecommendations()
        };
    }

    /**
     * 获取兼容性建议
     * @returns {Array} 建议列表
     */
    getRecommendations() {
        const recommendations = [];
        
        if (this.isLegacyBrowser()) {
            recommendations.push('建议升级到最新版本的浏览器以获得最佳体验');
        }
        
        if (!this.features.fetch) {
            recommendations.push('您的浏览器不支持Fetch API，已启用兼容模式');
        }
        
        if (!this.features.touchEvents && this.browserInfo.isMobile) {
            recommendations.push('触摸事件支持可能有限');
        }
        
        if (!this.features.performance) {
            recommendations.push('性能监控功能可能受限');
        }
        
        return recommendations;
    }
}

// 创建全局兼容性实例
window.browserCompatibility = new BrowserCompatibility();

// 在控制台输出兼容性报告
console.log('浏览器兼容性报告:', window.browserCompatibility.getCompatibilityReport());