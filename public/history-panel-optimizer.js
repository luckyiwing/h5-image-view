/**
 * 历史面板性能优化器
 * 专门解决历史面板打开时的卡顿问题
 */

class HistoryPanelOptimizer {
  constructor(imageCache, options = {}) {
    this.imageCache = imageCache;
    this.options = {
      maxVisibleItems: options.maxVisibleItems || 20, // 最多显示20个历史项目
      lazyLoadThreshold: options.lazyLoadThreshold || 5, // 懒加载阈值
      imageTimeout: options.imageTimeout || 2000, // 图片加载超时2秒
      batchSize: options.batchSize || 5, // 批量渲染大小
      ...options
    };

    // 虚拟滚动相关
    this.virtualScrollEnabled = true;
    this.itemHeight = 120; // 每个历史项目的高度
    this.visibleRange = { start: 0, end: 0 };
    
    // 渲染优化
    this.renderQueue = [];
    this.isRendering = false;
    this.intersectionObserver = null;
    
    // 图片加载管理
    this.loadingImages = new Set();
    this.failedImages = new Set();
    this.imageLoadPromises = new Map();

    this.initializeIntersectionObserver();
    console.log("HistoryPanelOptimizer 初始化完成", this.options);
  }

  /**
   * 初始化交叉观察器，用于懒加载
   */
  initializeIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadImageForItem(entry.target);
            }
          });
        },
        {
          root: null,
          rootMargin: '50px', // 提前50px开始加载
          threshold: 0.1
        }
      );
    }
  }

  /**
   * 优化的历史面板渲染
   * @param {Array} historyData - 历史数据
   * @param {HTMLElement} container - 容器元素
   * @param {Object} status - 历史状态
   */
  async renderHistoryPanel(historyData, container, status) {
    if (!historyData || historyData.length === 0) {
      this.renderEmptyState(container);
      return;
    }

    // 清空容器
    container.innerHTML = '';

    // 限制显示数量，避免DOM过多
    const displayData = historyData.slice(-this.options.maxVisibleItems);
    
    // 统一使用批量渲染，保持一致的网格布局
    // 对于大量数据，通过限制显示数量来优化性能
    await this.renderWithBatching(displayData, container, status);
  }

  /**
   * 使用虚拟滚动渲染（大量数据时）
   * @param {Array} data - 数据
   * @param {HTMLElement} container - 容器
   * @param {Object} status - 状态
   */
  async renderWithVirtualScroll(data, container, status) {
    // 创建虚拟滚动容器
    const scrollContainer = document.createElement('div');
    scrollContainer.className = 'history-virtual-scroll';
    scrollContainer.style.height = '400px';
    scrollContainer.style.overflowY = 'auto';

    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.style.height = `${data.length * this.itemHeight}px`;
    contentContainer.style.position = 'relative';

    // 计算可见范围
    this.calculateVisibleRange(data.length, 0);

    // 渲染可见项目
    await this.renderVisibleItems(data, contentContainer, status);

    // 监听滚动事件
    scrollContainer.addEventListener('scroll', 
      this.throttle((e) => {
        const scrollTop = e.target.scrollTop;
        const newStart = Math.floor(scrollTop / this.itemHeight);
        
        if (newStart !== this.visibleRange.start) {
          this.calculateVisibleRange(data.length, scrollTop);
          this.renderVisibleItems(data, contentContainer, status);
        }
      }, 100)
    );

    scrollContainer.appendChild(contentContainer);
    container.appendChild(scrollContainer);
  }

  /**
   * 使用批量渲染（中等数据量时）
   * @param {Array} data - 数据
   * @param {HTMLElement} container - 容器
   * @param {Object} status - 状态
   */
  async renderWithBatching(data, container, status) {
    const fragment = document.createDocumentFragment();
    
    // 分批渲染，避免阻塞UI
    for (let i = 0; i < data.length; i += this.options.batchSize) {
      const batch = data.slice(i, i + this.options.batchSize);
      
      // 创建批次项目
      const batchItems = batch.map((imageUrl, index) => 
        this.createOptimizedHistoryItem(imageUrl, i + index, status)
      );
      
      batchItems.forEach(item => fragment.appendChild(item));
      
      // 让出控制权，避免阻塞
      if (i + this.options.batchSize < data.length) {
        await this.nextTick();
      }
    }

    container.appendChild(fragment);
  }

  /**
   * 创建优化的历史项目
   * @param {string} imageUrl - 图片URL
   * @param {number} index - 索引
   * @param {Object} status - 状态
   * @returns {HTMLElement} 历史项目元素
   */
  createOptimizedHistoryItem(imageUrl, index, status) {
    const item = document.createElement('div');
    item.className = 'history-item optimized';
    item.dataset.index = index;
    item.dataset.url = imageUrl;

    // 检查是否为当前图片
    const isCurrent = (status.currentIndex === -1 && index === status.length - 1) || 
                     (status.currentIndex === index);
    
    if (isCurrent) {
      item.classList.add('current');
    }

    // 创建图片容器
    const imgContainer = document.createElement('div');
    imgContainer.className = 'history-item-img-container';

    // 创建占位符 - 使用与CSS一致的样式
    const placeholder = document.createElement('div');
    placeholder.className = 'history-item-placeholder';
    placeholder.style.cssText = `
      width: 100%;
      height: 80px;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    `;

    // 创建图片元素（但不立即加载）
    const img = document.createElement('img');
    img.alt = `历史图片 ${index + 1}`;
    img.style.cssText = `
      width: 100%;
      height: 80px;
      object-fit: cover;
      border-radius: 4px;
      display: none;
      opacity: 1;
      transition: opacity 0.3s;
    `;

    // 添加索引标签
    const indexLabel = document.createElement('div');
    indexLabel.className = 'history-item-index';
    indexLabel.textContent = index + 1;

    // 添加当前指示器
    if (isCurrent) {
      const currentIndicator = document.createElement('div');
      currentIndicator.className = 'history-item-current-indicator';
      currentIndicator.textContent = '当前';
      item.appendChild(currentIndicator);
    }

    // 点击事件
    item.addEventListener('click', () => {
      if (window.imageViewer && typeof window.imageViewer.jumpToHistoryIndex === 'function') {
        window.imageViewer.jumpToHistoryIndex(index);
      }
    });

    imgContainer.appendChild(placeholder);
    imgContainer.appendChild(img);
    item.appendChild(imgContainer);
    item.appendChild(indexLabel);

    // 使用交叉观察器进行懒加载
    if (this.intersectionObserver) {
      this.intersectionObserver.observe(item);
    } else {
      // 回退：延迟加载
      setTimeout(() => this.loadImageForItem(item), 100 * index);
    }

    return item;
  }

  /**
   * 为历史项目加载图片
   * @param {HTMLElement} item - 历史项目元素
   */
  async loadImageForItem(item) {
    const imageUrl = item.dataset.url;
    const img = item.querySelector('img');
    const placeholder = item.querySelector('.history-item-placeholder');

    if (!imageUrl || !img || this.loadingImages.has(imageUrl)) {
      return;
    }

    // 如果之前加载失败，显示错误状态
    if (this.failedImages.has(imageUrl)) {
      this.showImageError(img, placeholder);
      return;
    }

    this.loadingImages.add(imageUrl);

    try {
      // 首先检查缓存
      const cachedImage = this.imageCache.get(imageUrl);
      
      if (cachedImage) {
        const cached = await cachedImage;
        if (cached && cached.src) {
          this.showImage(img, placeholder, cached.src);
          console.log(`历史图片从缓存加载: ${imageUrl}`);
          return;
        }
      }

      // 缓存未命中，加载图片
      await this.loadImageWithTimeout(img, placeholder, imageUrl);
      
    } catch (error) {
      console.warn(`历史图片加载失败: ${imageUrl}`, error);
      this.failedImages.add(imageUrl);
      this.showImageError(img, placeholder);
    } finally {
      this.loadingImages.delete(imageUrl);
    }
  }

  /**
   * 带超时的图片加载
   * @param {HTMLImageElement} img - 图片元素
   * @param {HTMLElement} placeholder - 占位符元素
   * @param {string} imageUrl - 图片URL
   */
  async loadImageWithTimeout(img, placeholder, imageUrl) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('图片加载超时'));
      }, this.options.imageTimeout);

      const tempImg = new Image();
      tempImg.crossOrigin = 'anonymous';
      tempImg.decoding = 'async';

      tempImg.onload = () => {
        clearTimeout(timeout);
        this.showImage(img, placeholder, imageUrl);
        
        // 异步缓存图片
        setTimeout(() => {
          this.imageCache.set(imageUrl, tempImg).catch(console.warn);
        }, 0);
        
        resolve();
      };

      tempImg.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('图片加载失败'));
      };

      tempImg.src = imageUrl;
    });
  }

  /**
   * 显示图片
   * @param {HTMLImageElement} img - 图片元素
   * @param {HTMLElement} placeholder - 占位符元素
   * @param {string} src - 图片源
   */
  showImage(img, placeholder, src) {
    img.src = src;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    
    // 添加淡入动画
    img.style.opacity = '0';
    img.style.transition = 'opacity 0.3s ease';
    
    requestAnimationFrame(() => {
      img.style.opacity = '1';
    });
  }

  /**
   * 显示图片错误状态
   * @param {HTMLImageElement} img - 图片元素
   * @param {HTMLElement} placeholder - 占位符元素
   */
  showImageError(img, placeholder) {
    placeholder.style.background = '#f5f5f5';
    placeholder.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 12px;">
        <span>加载失败</span>
      </div>
    `;
  }

  /**
   * 渲染空状态
   * @param {HTMLElement} container - 容器元素
   */
  renderEmptyState(container) {
    container.innerHTML = `
      <div class="history-empty optimized">
        <div class="empty-icon">📷</div>
        <div class="empty-text">暂无浏览历史</div>
        <div class="empty-subtext">开始浏览图片后，历史记录将显示在这里</div>
      </div>
    `;
  }

  /**
   * 计算可见范围（虚拟滚动）
   * @param {number} totalItems - 总项目数
   * @param {number} scrollTop - 滚动位置
   */
  calculateVisibleRange(totalItems, scrollTop) {
    const containerHeight = 400; // 容器高度
    const visibleCount = Math.ceil(containerHeight / this.itemHeight) + 2; // 多渲染2个作为缓冲
    
    const start = Math.max(0, Math.floor(scrollTop / this.itemHeight) - 1);
    const end = Math.min(totalItems, start + visibleCount);
    
    this.visibleRange = { start, end };
  }

  /**
   * 渲染可见项目（虚拟滚动）
   * @param {Array} data - 数据
   * @param {HTMLElement} container - 容器
   * @param {Object} status - 状态
   */
  async renderVisibleItems(data, container, status) {
    // 清空现有项目
    container.innerHTML = '';
    
    const fragment = document.createDocumentFragment();
    
    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      const item = this.createOptimizedHistoryItem(data[i], i, status);
      item.style.position = 'absolute';
      // 修复：使用正确的虚拟滚动位置计算
      // 在虚拟滚动中，每个项目的位置应该基于其在数据中的实际索引
      item.style.top = `${i * this.itemHeight}px`;
      item.style.width = '100%';
      item.style.height = `${this.itemHeight}px`;
      
      fragment.appendChild(item);
    }
    
    container.appendChild(fragment);
  }

  /**
   * 节流函数
   * @param {Function} func - 函数
   * @param {number} delay - 延迟
   * @returns {Function} 节流后的函数
   */
  throttle(func, delay) {
    let timeoutId;
    let lastExecTime = 0;
    
    return function (...args) {
      const currentTime = Date.now();
      
      if (currentTime - lastExecTime > delay) {
        func.apply(this, args);
        lastExecTime = currentTime;
      } else {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          func.apply(this, args);
          lastExecTime = Date.now();
        }, delay - (currentTime - lastExecTime));
      }
    };
  }

  /**
   * 下一个事件循环
   * @returns {Promise<void>}
   */
  nextTick() {
    return new Promise(resolve => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    this.loadingImages.clear();
    this.failedImages.clear();
    this.imageLoadPromises.clear();
    this.renderQueue = [];
    
    console.log("HistoryPanelOptimizer 已清理");
  }
}

// 导出到全局作用域
window.HistoryPanelOptimizer = HistoryPanelOptimizer;