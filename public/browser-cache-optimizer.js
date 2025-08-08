/**
 * 浏览器缓存优化器
 * 专门处理图片的浏览器原生缓存，减少内存使用
 */

class BrowserCacheOptimizer {
  constructor(options = {}) {
    this.options = {
      // 使用浏览器原生缓存策略
      enableServiceWorker: options.enableServiceWorker !== false,
      cacheStrategy: options.cacheStrategy || 'cache-first',
      maxAge: options.maxAge || 3600, // 1小时
      enablePreload: options.enablePreload !== false,
      maxPreloadLinks: options.maxPreloadLinks || 3,
      ...options
    };

    this.preloadedUrls = new Set();
    this.linkElements = new Map();
    this.isServiceWorkerReady = false;

    this.init();
  }

  /**
   * 初始化浏览器缓存优化器
   */
  async init() {
    console.log('BrowserCacheOptimizer 初始化开始');
    
    // 注册Service Worker（如果支持）
    if (this.options.enableServiceWorker && 'serviceWorker' in navigator) {
      await this.registerServiceWorker();
    }

    // 设置预加载策略
    if (this.options.enablePreload) {
      this.setupPreloadStrategy();
    }

    console.log('BrowserCacheOptimizer 初始化完成', {
      serviceWorker: this.isServiceWorkerReady,
      preload: this.options.enablePreload,
      strategy: this.options.cacheStrategy
    });
  }

  /**
   * 注册Service Worker进行缓存管理
   */
  async registerServiceWorker() {
    try {
      // 由于blob URL不被支持，我们改用其他缓存策略
      console.log('跳过Service Worker注册，使用浏览器原生缓存');
      this.isServiceWorkerReady = false;
      
      // 使用Cache API作为替代方案
      if ('caches' in window) {
        await this.initializeCacheAPI();
        console.log('Cache API 初始化成功');
      }
    } catch (error) {
      console.warn('缓存初始化失败:', error);
    }
  }

  /**
   * 生成Service Worker代码
   */
  generateServiceWorkerCode() {
    return `
      const CACHE_NAME = 'image-cache-v1';
      const MAX_AGE = ${this.options.maxAge};

      self.addEventListener('install', (event) => {
        console.log('Service Worker 安装中');
        self.skipWaiting();
      });

      self.addEventListener('activate', (event) => {
        console.log('Service Worker 激活中');
        event.waitUntil(self.clients.claim());
      });

      self.addEventListener('fetch', (event) => {
        const url = new URL(event.request.url);
        
        // 只处理图片请求
        if (event.request.destination === 'image' || 
            /\\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url.pathname)) {
          
          event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
              return cache.match(event.request).then(response => {
                if (response) {
                  // 检查缓存是否过期
                  const cachedTime = response.headers.get('sw-cached-time');
                  if (cachedTime && Date.now() - parseInt(cachedTime) < MAX_AGE * 1000) {
                    console.log('从Service Worker缓存返回:', event.request.url);
                    return response;
                  }
                }

                // 从网络获取
                return fetch(event.request).then(networkResponse => {
                  if (networkResponse.ok) {
                    // 克隆响应并添加缓存时间戳
                    const responseToCache = networkResponse.clone();
                    const headers = new Headers(responseToCache.headers);
                    headers.set('sw-cached-time', Date.now().toString());
                    
                    const cachedResponse = new Response(responseToCache.body, {
                      status: responseToCache.status,
                      statusText: responseToCache.statusText,
                      headers: headers
                    });

                    cache.put(event.request, cachedResponse);
                    console.log('图片已缓存到Service Worker:', event.request.url);
                  }
                  return networkResponse;
                }).catch(error => {
                  console.error('网络请求失败:', error);
                  // 如果有缓存，即使过期也返回
                  return response || new Response('', { status: 404 });
                });
              });
            })
          );
        }
      });
    `;
  }

  /**
   * 初始化Cache API作为Service Worker的替代方案
   */
  async initializeCacheAPI() {
    try {
      // 打开缓存
      this.cache = await caches.open('image-cache-v1');
      console.log('Cache API 缓存已打开');
      
      // 设置缓存清理定时器
      this.setupCacheCleanup();
    } catch (error) {
      console.warn('Cache API 初始化失败:', error);
    }
  }

  /**
   * 设置缓存清理定时器
   */
  setupCacheCleanup() {
    // 每30分钟清理一次过期缓存
    setInterval(async () => {
      await this.cleanupExpiredCache();
    }, 30 * 60 * 1000);
  }

  /**
   * 清理过期的缓存
   */
  async cleanupExpiredCache() {
    if (!this.cache) return;

    try {
      const requests = await this.cache.keys();
      const now = Date.now();
      
      for (const request of requests) {
        const response = await this.cache.match(request);
        if (response) {
          const cachedTime = response.headers.get('cached-time');
          if (cachedTime && now - parseInt(cachedTime) > this.options.maxAge * 1000) {
            await this.cache.delete(request);
            console.log('清理过期缓存:', request.url);
          }
        }
      }
    } catch (error) {
      console.warn('清理过期缓存失败:', error);
    }
  }

  /**
   * 设置预加载策略
   */
  setupPreloadStrategy() {
    // 创建预加载容器
    this.preloadContainer = document.createElement('div');
    this.preloadContainer.style.display = 'none';
    this.preloadContainer.id = 'browser-cache-preload-container';
    document.head.appendChild(this.preloadContainer);
  }

  /**
   * 使用浏览器原生预加载 - 修复跨域问题
   * @param {string} imageUrl - 图片URL
   * @returns {Promise<void>}
   */
  async preloadImage(imageUrl) {
    if (this.preloadedUrls.has(imageUrl)) {
      console.log('图片已预加载（浏览器缓存）:', imageUrl);
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // 优先使用Image对象预加载，避免link preload的跨域问题
      const img = new Image();
      
      // 检查是否是跨域图片
      const isCurrentDomain = imageUrl.startsWith(window.location.origin);
      if (!isCurrentDomain) {
        // 跨域图片不设置crossOrigin，避免CORS问题
        console.log('跨域图片预加载（不设置crossOrigin）:', imageUrl);
      } else {
        img.crossOrigin = 'anonymous';
      }
      
      const startTime = performance.now();
      
      img.onload = async () => {
        const loadTime = performance.now() - startTime;
        console.log('Image对象预加载完成:', imageUrl, `${loadTime.toFixed(2)}ms`);
        this.preloadedUrls.add(imageUrl);
        
        // 尝试将图片缓存到Cache API
        if (this.cache) {
          try {
            const response = await fetch(imageUrl, { 
              mode: isCurrentDomain ? 'cors' : 'no-cors',
              cache: 'force-cache'
            });
            if (response.ok || response.type === 'opaque') {
              // 添加缓存时间戳
              const headers = new Headers(response.headers);
              headers.set('cached-time', Date.now().toString());
              
              const cachedResponse = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers
              });
              
              await this.cache.put(imageUrl, cachedResponse);
              console.log('图片已缓存到Cache API:', imageUrl);
            }
          } catch (error) {
            console.warn('缓存到Cache API失败:', imageUrl, error);
          }
        }
        
        resolve();
      };
      
      img.onerror = () => {
        console.warn('Image对象预加载失败:', imageUrl);
        reject(new Error(`预加载失败: ${imageUrl}`));
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * 批量预加载图片
   * @param {string[]} imageUrls - 图片URL数组
   * @returns {Promise<void>}
   */
  async preloadImages(imageUrls) {
    const limitedUrls = imageUrls.slice(0, this.options.maxPreloadLinks);
    const preloadPromises = limitedUrls.map(url => 
      this.preloadImage(url).catch(error => {
        console.warn('批量预加载中的单个图片失败:', error);
        return null; // 继续处理其他图片
      })
    );

    await Promise.allSettled(preloadPromises);
    console.log(`批量预加载完成，处理了 ${limitedUrls.length} 张图片`);
  }

  /**
   * 检查图片是否已缓存
   * @param {string} imageUrl - 图片URL
   * @returns {Promise<boolean>}
   */
  async isImageCached(imageUrl) {
    // 检查Cache API缓存
    if (this.cache) {
      try {
        const response = await this.cache.match(imageUrl);
        if (response) {
          // 检查缓存是否过期
          const cachedTime = response.headers.get('cached-time');
          if (cachedTime && Date.now() - parseInt(cachedTime) < this.options.maxAge * 1000) {
            console.log('图片在Cache API缓存中:', imageUrl);
            return true;
          } else {
            // 缓存过期，删除
            await this.cache.delete(imageUrl);
            console.log('缓存已过期，已删除:', imageUrl);
          }
        }
      } catch (error) {
        console.warn('检查Cache API缓存失败:', error);
      }
    }

    // 检查是否已预加载
    return this.preloadedUrls.has(imageUrl);
  }

  /**
   * 清理过期的预加载链接
   */
  cleanupPreloadLinks() {
    const now = Date.now();
    const maxAge = this.options.maxAge * 1000;

    for (const [url, link] of this.linkElements) {
      const createdTime = parseInt(link.dataset.createdTime || '0');
      if (now - createdTime > maxAge) {
        link.remove();
        this.linkElements.delete(url);
        this.preloadedUrls.delete(url);
        console.log('清理过期预加载链接:', url);
      }
    }
  }

  /**
   * 获取缓存统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      serviceWorkerReady: this.isServiceWorkerReady,
      preloadedCount: this.preloadedUrls.size,
      linkElementsCount: this.linkElements.size,
      maxPreloadLinks: this.options.maxPreloadLinks,
      cacheStrategy: this.options.cacheStrategy,
      maxAge: this.options.maxAge
    };
  }

  /**
   * 清理所有缓存和预加载资源
   */
  async cleanup() {
    // 清理预加载链接
    for (const link of this.linkElements.values()) {
      link.remove();
    }
    this.linkElements.clear();
    this.preloadedUrls.clear();

    // 清理预加载容器
    if (this.preloadContainer) {
      this.preloadContainer.remove();
    }

    // 清理Service Worker缓存
    if ('caches' in window) {
      try {
        await caches.delete('image-cache-v1');
        console.log('Service Worker缓存已清理');
      } catch (error) {
        console.warn('清理Service Worker缓存失败:', error);
      }
    }

    console.log('BrowserCacheOptimizer 清理完成');
  }

  /**
   * 优化图片加载 - 修复跨域问题
   * @param {string} imageUrl - 图片URL
   * @returns {Promise<HTMLImageElement>}
   */
  async optimizedImageLoad(imageUrl) {
    // 检查是否已缓存
    const isCached = await this.isImageCached(imageUrl);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      // 检查是否是跨域图片，避免CORS问题
      const isCurrentDomain = imageUrl.startsWith(window.location.origin);
      if (!isCurrentDomain) {
        // 跨域图片不设置crossOrigin，避免CORS问题
        console.log('跨域图片加载（不设置crossOrigin）:', imageUrl);
      } else {
        img.crossOrigin = 'anonymous';
      }
      
      const startTime = performance.now();
      
      img.onload = async () => {
        const loadTime = performance.now() - startTime;
        console.log(`优化图片加载完成: ${imageUrl}`, {
          loadTime: loadTime.toFixed(2) + 'ms',
          fromCache: isCached
        });
        
        // 如果图片未缓存，尝试缓存到Cache API
        if (!isCached && this.cache) {
          try {
            const response = await fetch(imageUrl, { 
              mode: isCurrentDomain ? 'cors' : 'no-cors',
              cache: 'force-cache'
            });
            if (response.ok || response.type === 'opaque') {
              const headers = new Headers(response.headers);
              headers.set('cached-time', Date.now().toString());
              
              const cachedResponse = new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers: headers
              });
              
              await this.cache.put(imageUrl, cachedResponse);
              console.log('图片已缓存到Cache API（加载后）:', imageUrl);
            }
          } catch (error) {
            console.warn('加载后缓存失败:', imageUrl, error);
          }
        }
        
        resolve(img);
      };
      
      img.onerror = () => {
        console.error('优化图片加载失败:', imageUrl);
        reject(new Error(`图片加载失败: ${imageUrl}`));
      };
      
      img.src = imageUrl;
    });
  }
}

// 导出到全局作用域
window.BrowserCacheOptimizer = BrowserCacheOptimizer;