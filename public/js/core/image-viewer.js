/**
 * 图片查看器核心模块
 */

import { APP_CONFIG, ANIMATION_DIRECTIONS } from '../config/app-config.js';
import { ApiService } from '../services/api-service.js';
import { UIController } from '../controllers/ui-controller.js';
import { throttle, debounce } from '../utils/helpers.js';

/**
 * 图片展示器主类 - 管理图片加载和显示
 */
export class ImageViewer {
  constructor() {
    console.log("ImageViewer 初始化");
    this.apiService = new ApiService();
    this.uiController = new UIController();
    this.responsiveManager = new ResponsiveManager();

    // 初始化图片URL队列系统
    this.imageUrlQueue = [];
    this.maxQueueSize = APP_CONFIG.cache.maxQueueSize;

    // 初始化历史记录系统
    this.imageHistory = [];
    this.currentHistoryIndex = -1;
    this.maxHistorySize = APP_CONFIG.cache.maxHistorySize;
    this.currentImageUrl = null;
    
    this.isInitialLoad = true;

    // 初始化性能组件
    this.initializePerformanceComponents();
    
    // 初始化用户引导管理器
    this.initializeUserGuide();

    // 初始化触摸状态和事件
    this.initializeTouchState();
    this.bindEvents();
    this.setupResponsiveHandlers();
    
    // 确保错误信息在初始化时是隐藏的
    this.uiController.hideError();
    
    // 延迟初始图片加载
    setTimeout(() => {
      this.loadFirstImage();
    }, 2000);

    // 延迟启动预加载策略
    setTimeout(() => {
      if (this.preloadStrategy) {
        this.preloadStrategy.startPreloading();
      }
    }, 5000);

    // 初始化用户引导功能
    setTimeout(() => {
      this.initializeUserGuideFeatures();
    }, 1000);

    this.bindHelpButton();
  }

  /**
   * 初始化性能组件
   */
  initializePerformanceComponents() {
    try {
      // 浏览器缓存优化器
      this.browserCacheOptimizer = new BrowserCacheOptimizer({
        enableServiceWorker: true,
        cacheStrategy: "cache-first",
        maxAge: 3600,
        maxPreloadLinks: 2,
      });

      // 图片缓存
      this.imageCache = new ImageCache({
        maxCacheSize: APP_CONFIG.cache.maxCacheSize,
        maxMemorySize: APP_CONFIG.cache.maxMemorySize,
      });

      // 性能监控器
      this.performanceMonitor = new PerformanceMonitor();

      // 预加载策略
      this.preloadStrategy = new EnhancedPreloadStrategy(
        this.apiService,
        this.imageCache,
        {
          preloadCount: APP_CONFIG.performance.preloadCount,
          adaptiveThreshold: APP_CONFIG.performance.adaptiveThreshold,
          maxPreloadCount: APP_CONFIG.performance.maxPreloadCount,
          minPreloadCount: 1,
          preloadDelay: APP_CONFIG.performance.preloadDelay,
          performanceMonitor: this.performanceMonitor,
          imageViewer: this,
        }
      );

      // 事件优化器
      this.eventOptimizer = new EventOptimizer();

      // 动画控制器
      this.animationController = new AnimationController({
        duration: APP_CONFIG.ui.animationDuration,
        easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        enableHardwareAcceleration: true,
        disableInteractionDuringAnimation: true,
      });

      // 历史面板优化器
      this.historyPanelOptimizer = new HistoryPanelOptimizer(this.imageCache, {
        maxVisibleItems: 20,
        imageTimeout: 1500,
        batchSize: 5,
        lazyLoadThreshold: 3,
      });

      console.log("性能组件初始化完成");
    } catch (error) {
      console.error("性能组件初始化失败:", error);
    }
  }

  /**
   * 初始化用户引导
   */
  initializeUserGuide() {
    try {
      this.userGuideManager = new UserGuideManager({
        storageKey: "h5-image-viewer-settings",
        language: "zh-CN",
        autoShow: true,
      });
    } catch (error) {
      console.error("用户引导管理器初始化失败:", error);
      this.userGuideManager = null;

      if (window.GuideErrorHandlers?.guideErrorHandler) {
        window.GuideErrorHandlers.guideErrorHandler.logError(
          "UserGuideManager初始化",
          error
        );
      }
    }
  }

  /**
   * 向图片URL队列添加URL
   * @param {string} imageUrl - 图片URL
   */
  addToQueue(imageUrl) {
    if (!imageUrl || this.imageUrlQueue.includes(imageUrl)) {
      return;
    }

    if (this.imageUrlQueue.length >= this.maxQueueSize) {
      const removedUrl = this.imageUrlQueue.shift();
      console.log("队列已满，移除最旧的URL:", removedUrl);
    }

    this.imageUrlQueue.push(imageUrl);
    console.log("添加URL到队列:", imageUrl, "队列长度:", this.imageUrlQueue.length);
  }

  /**
   * 从队列获取下一个图片URL
   * @returns {string|null} 图片URL或null
   */
  getNextFromQueue() {
    if (this.imageUrlQueue.length === 0) {
      return null;
    }

    const url = this.imageUrlQueue.shift();
    console.log("从队列获取URL:", url, "剩余队列长度:", this.imageUrlQueue.length);
    return url;
  }

  /**
   * 添加图片到历史记录
   * @param {string} imageUrl - 图片URL
   */
  addToHistory(imageUrl) {
    if (!imageUrl) return;

    if (this.currentHistoryIndex !== -1) {
      this.imageHistory = this.imageHistory.slice(0, this.currentHistoryIndex + 1);
      this.currentHistoryIndex = -1;
    }

    if (this.imageHistory.length > 0 && this.imageHistory[this.imageHistory.length - 1] === imageUrl) {
      return;
    }

    this.imageHistory.push(imageUrl);

    if (this.imageHistory.length > this.maxHistorySize) {
      this.imageHistory.shift();
      console.log("历史记录已满，移除最旧的记录");
    }

    console.log("添加到历史记录:", imageUrl, "历史长度:", this.imageHistory.length);
  }

  /**
   * 从历史记录获取上一张图片
   * @returns {string|null} 上一张图片URL或null
   */
  getPreviousFromHistory() {
    if (this.imageHistory.length === 0) {
      return null;
    }

    if (this.currentHistoryIndex === -1) {
      if (this.imageHistory.length < 2) {
        return null;
      }
      this.currentHistoryIndex = this.imageHistory.length - 2;
    } else {
      this.currentHistoryIndex--;
      if (this.currentHistoryIndex < 0) {
        this.currentHistoryIndex = 0;
        return null;
      }
    }

    const previousUrl = this.imageHistory[this.currentHistoryIndex];
    console.log("从历史记录获取上一张:", previousUrl, "索引:", this.currentHistoryIndex);
    return previousUrl;
  }

  /**
   * 检查是否可以返回上一张
   * @returns {boolean} 是否有上一张图片
   */
  canGoPrevious() {
    if (this.imageHistory.length === 0) return false;
    
    if (this.currentHistoryIndex === -1) {
      return this.imageHistory.length >= 2;
    }
    
    return this.currentHistoryIndex > 0;
  }

  /**
   * 初始化触摸状态
   */
  initializeTouchState() {
    this.touchState = {
      startY: 0,
      currentY: 0,
      deltaY: 0,
      isScrolling: false,
      startTime: 0,
      minSwipeDistance: APP_CONFIG.touch.minSwipeDistance,
      maxSwipeTime: APP_CONFIG.touch.maxSwipeTime,
      minSwipeVelocity: APP_CONFIG.touch.minSwipeVelocity,
    };
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 监听网络状态变化
    window.addEventListener("online", () => {
      console.log("网络连接已恢复");
      if (this.uiController.isErrorState()) {
        this.uiController.showUserFeedback("网络已恢复");
        this.loadImage();
      }
    });

    window.addEventListener("offline", () => {
      console.log("网络连接已断开");
      this.uiController.showUserFeedback("网络连接已断开", 2000);
    });

    this.bindDesktopEvents();
    this.bindTouchEvents();
  }

  /**
   * 绑定桌面端交互事件
   */
  bindDesktopEvents() {
    const compatibility = window.browserCompatibility;

    const optimizedWheelHandler = this.eventOptimizer.throttle(
      (event) => this.handleWheelEvent(event),
      300,
      "wheel"
    );

    const optimizedKeyHandler = this.eventOptimizer.throttle(
      (event) => this.handleKeyboardEvent(event),
      300,
      "keyboard"
    );

    compatibility.addEventListener(window, "wheel", optimizedWheelHandler, {
      passive: false,
    });
    compatibility.addEventListener(window, "keydown", optimizedKeyHandler, {
      passive: false,
    });

    console.log("桌面端交互事件已绑定");
  }

  /**
   * 绑定移动端触摸交互事件
   */
  bindTouchEvents() {
    if (!this.uiController.imageContainer) return;

    this.uiController.imageContainer.addEventListener(
      "touchstart",
      (event) => this.handleTouchStart(event),
      { passive: false }
    );

    this.uiController.imageContainer.addEventListener(
      "touchmove", 
      (event) => this.handleTouchMove(event),
      { passive: false }
    );

    this.uiController.imageContainer.addEventListener(
      "touchend",
      (event) => this.handleTouchEnd(event),
      { passive: false }
    );

    console.log("移动端触摸交互事件已绑定");
  }

  /**
   * 设置响应式处理器
   */
  setupResponsiveHandlers() {
    if (!this.responsiveManager) return;

    this.responsiveManager.onOrientationChange(
      (newOrientation, oldOrientation, deviceInfo) => {
        console.log(`屏幕方向变化: ${oldOrientation} -> ${newOrientation}`);
        this.uiController.showUserFeedback(
          `屏幕已${newOrientation === "portrait" ? "竖屏" : "横屏"}`,
          1000
        );
        this.adjustCurrentImageSize();
      }
    );

    this.responsiveManager.onDeviceChange(
      (newDeviceType, oldDeviceType, deviceInfo) => {
        console.log(`设备类型变化: ${oldDeviceType} -> ${newDeviceType}`);
        this.adjustCurrentImageSize();
      }
    );

    this.responsiveManager.onResize((deviceInfo) => {
      this.adjustCurrentImageSize();
    });

    console.log("响应式处理器已设置");
  }

  /**
   * 调整当前图片尺寸
   */
  adjustCurrentImageSize() {
    if (!this.uiController.imageContainer) return;
    
    const currentImg = this.uiController.imageContainer.querySelector("img");
    if (currentImg && currentImg.complete) {
      setTimeout(() => {
        if (this.responsiveManager) {
          this.responsiveManager.adjustImageSize(currentImg);
        }
      }, 100);
    }
  }

  /**
   * 处理触摸开始事件
   * @param {TouchEvent} event - 触摸事件对象
   */
  handleTouchStart(event) {
    if (this.uiController.isLoadingState() || this.isImageSwitchingPaused()) {
      return;
    }

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchState.startY = touch.clientY;
    this.touchState.currentY = touch.clientY;
    this.touchState.deltaY = 0;
    this.touchState.isScrolling = true;
    this.touchState.startTime = Date.now();

    console.log("触摸开始:", {
      startY: this.touchState.startY,
      startTime: this.touchState.startTime,
    });
  }

  /**
   * 处理触摸移动事件
   * @param {TouchEvent} event - 触摸事件对象
   */
  handleTouchMove(event) {
    if (!this.touchState.isScrolling || this.uiController.isLoadingState()) {
      return;
    }

    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchState.currentY = touch.clientY;
    this.touchState.deltaY = this.touchState.currentY - this.touchState.startY;

    event.preventDefault();
  }

  /**
   * 处理触摸结束事件
   * @param {TouchEvent} event - 触摸事件对象
   */
  handleTouchEnd(event) {
    if (!this.touchState.isScrolling || this.uiController.isLoadingState()) {
      this.touchState.isScrolling = false;
      return;
    }

    const endTime = Date.now();
    const swipeTime = endTime - this.touchState.startTime;
    const swipeDistance = Math.abs(this.touchState.deltaY);
    const swipeVelocity = swipeDistance / swipeTime;

    const isValidSwipe = this.isValidSwipe(swipeDistance, swipeTime, swipeVelocity);

    if (isValidSwipe) {
      this.handleSwipeGesture(this.touchState.deltaY);
    }

    this.touchState.isScrolling = false;
    this.touchState.deltaY = 0;
  }

  /**
   * 验证滑动是否有效
   * @param {number} distance - 滑动距离
   * @param {number} time - 滑动时间
   * @param {number} velocity - 滑动速度
   * @returns {boolean} 是否为有效滑动
   */
  isValidSwipe(distance, time, velocity) {
    const hasMinDistance = distance >= this.touchState.minSwipeDistance;
    const isWithinTimeLimit = time <= this.touchState.maxSwipeTime;
    const hasMinVelocity = velocity >= this.touchState.minSwipeVelocity;

    return hasMinDistance && isWithinTimeLimit && hasMinVelocity;
  }

  /**
   * 处理滑动手势
   * @param {number} deltaY - Y轴偏移量
   */
  handleSwipeGesture(deltaY) {
    if (deltaY > 0) {
      console.log("向下滑动，切换到上一张图片");
      this.switchToPreviousImage();
    } else if (deltaY < 0) {
      console.log("向上滑动，切换到下一张图片");
      this.switchToNextImage();
    }
  }

  /**
   * 处理鼠标滚轮事件
   * @param {WheelEvent} event - 滚轮事件对象
   */
  handleWheelEvent(event) {
    event.preventDefault();

    if (this.uiController.isLoadingState() || this.isImageSwitchingPaused()) {
      return;
    }

    if (event.deltaY > 0) {
      this.switchToNextImage();
    } else if (event.deltaY < 0) {
      this.switchToPreviousImage();
    }
  }

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event - 键盘事件对象
   */
  handleKeyboardEvent(event) {
    if (this.uiController.isLoadingState() || this.isImageSwitchingPaused()) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        this.switchToNextImage();
        break;
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        this.switchToPreviousImage();
        break;
      case "h":
      case "H":
        if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
          event.preventDefault();
          this.toggleHistoryPanel();
        } else if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.showHistoryStatus();
        }
        break;
    }
  }

  /**
   * 切换到下一张图片
   */
  async switchToNextImage() {
    if (this.animationController?.isAnimationInProgress()) {
      return;
    }

    this.uiController.showSwitchFeedback("next");

    try {
      const nextFromHistory = this.getNextFromHistory();
      if (nextFromHistory) {
        await this.displayHistoryImage(nextFromHistory, ANIMATION_DIRECTIONS.UP);
        return;
      }

      if (this.currentImageUrl) {
        this.addToHistory(this.currentImageUrl);
      }

      await this.loadImageWithAnimation(ANIMATION_DIRECTIONS.UP);
    } catch (error) {
      console.error("切换到下一张图片失败:", error);
      this.loadImage();
    }
  }

  /**
   * 切换到上一张图片
   */
  async switchToPreviousImage() {
    if (this.animationController?.isAnimationInProgress()) {
      return;
    }

    this.uiController.showSwitchFeedback("previous");

    try {
      const previousUrl = this.getPreviousFromHistory();
      if (previousUrl) {
        await this.displayHistoryImage(previousUrl, ANIMATION_DIRECTIONS.DOWN);
        return;
      }

      this.uiController.showUserFeedback("已经是第一张图片", 1000);
    } catch (error) {
      console.error("切换到上一张图片失败:", error);
      this.uiController.showUserFeedback("切换失败，请重试", 1000);
    }
  }

  /**
   * 首次图片加载方法
   */
  async loadFirstImage() {
    try {
      console.log("开始首次图片加载...");
      
      this.uiController.hideError();
      this.uiController.hideLoading();
      
      if (!this.apiService) {
        this.uiController.showUserFeedback("正在初始化服务...", 2000);
        return;
      }
      
      this.uiController.showUserFeedback("正在准备图片浏览器...", 1500);
      
      setTimeout(async () => {
        try {
          this.uiController.hideError();
          await this.loadImage();
        } catch (loadError) {
          console.error("延迟加载失败:", loadError);
          this.uiController.hideError();
          this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
        }
      }, 800);
      
    } catch (error) {
      console.error("首次图片加载失败:", error);
      this.uiController.hideError();
      this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
    }
  }

  /**
   * 优化的图片加载方法
   */
  async loadImage() {
    const startTime = performance.now();

    try {
      this.uiController.showLoading();
      console.log("开始优化图片加载...");

      if (!this.apiService.isOnline()) {
        throw new Error("网络连接不可用，请检查网络设置");
      }

      let imageUrl;
      let fromQueue = false;

      imageUrl = this.getNextFromQueue();
      if (imageUrl) {
        fromQueue = true;
        console.log("从预加载队列获取图片URL:", imageUrl);
      } else {
        const apiStartTime = performance.now();
        imageUrl = await this.apiService.fetchImage();
        const apiEndTime = performance.now();

        if (this.performanceMonitor) {
          this.performanceMonitor.recordApiCallTime(apiStartTime, apiEndTime, true);
        }
        console.log("从API获取新图片URL:", imageUrl);
      }

      // 检查浏览器缓存
      const isBrowserCached = this.browserCacheOptimizer ? 
        await this.browserCacheOptimizer.isImageCached(imageUrl) : false;
      
      if (isBrowserCached) {
        console.log("使用浏览器缓存图片:", imageUrl);
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(true);
        }

        if (this.browserCacheOptimizer) {
          await this.browserCacheOptimizer.optimizedImageLoad(imageUrl);
        }
        await this.uiController.displayImage(imageUrl, this.responsiveManager);
      } else {
        // 检查内存缓存
        let cachedImage = this.imageCache?.get(imageUrl);

        if (cachedImage) {
          console.log("使用内存缓存图片:", imageUrl);
          if (this.performanceMonitor) {
            this.performanceMonitor.recordCacheHit(true);
          }
          await this.displayCachedImage(cachedImage, imageUrl);
        } else {
          console.log("缓存未命中，加载新图片:", imageUrl);
          if (this.performanceMonitor) {
            this.performanceMonitor.recordCacheHit(false);
          }

          if (this.browserCacheOptimizer) {
            await this.browserCacheOptimizer.preloadImage(imageUrl);
          }
          await this.uiController.displayImage(imageUrl, this.responsiveManager);
        }
      }

      // 触发预加载
      if (this.imageUrlQueue.length < 2) {
        if (this.preloadStrategy && Math.random() < 0.6) {
          this.preloadStrategy.smartPreload(imageUrl);
        }

        if (fromQueue && this.preloadStrategy && Math.random() < 0.4) {
          this.preloadStrategy.preloadOnImageLoad(imageUrl);
        }
      }

      this.currentImageUrl = imageUrl;
      
      if (this.isInitialLoad) {
        this.isInitialLoad = false;
        console.log("初始图片加载成功");
      }

      const endTime = performance.now();
      console.log(`优化图片加载完成，总耗时: ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      console.error("图片加载失败:", error);

      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "loadImage");
        this.performanceMonitor.recordApiCallTime(startTime, endTime, false);
      }

      if (this.isInitialLoad) {
        this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
        this.isInitialLoad = false;
      } else {
        this.uiController.showError(error, () => this.loadImage());
      }
    }
  }

  /**
   * 显示缓存的图片
   * @param {HTMLImageElement} cachedImage - 缓存的图片元素
   * @param {string} imageUrl - 图片URL
   */
  async displayCachedImage(cachedImage, imageUrl) {
    return new Promise((resolve) => {
      this.uiController.clearImage();

      const img = cachedImage.cloneNode();

      if (this.responsiveManager) {
        this.responsiveManager.adjustImageSize(img);
      }

      img.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      img.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      if (this.uiController.imageContainer) {
        this.uiController.imageContainer.appendChild(img);
      }

      setTimeout(() => {
        img.style.opacity = "1";
        img.style.transform = "scale(1)";
      }, 50);

      this.uiController.hideLoading();
      this.uiController.hideError();
      resolve();
    });
  }

  /**
   * 检查图片切换是否被暂停
   * @returns {boolean} 是否被暂停
   */
  isImageSwitchingPaused() {
    return this.imageSwitchingPaused || false;
  }

  /**
   * 切换历史面板显示/隐藏
   */
  toggleHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      this.closeHistoryPanel();
    } else {
      this.openHistoryPanel();
    }
  }

  /**
   * 打开历史面板
   */
  openHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    panel.classList.add('open');
    
    // 延迟更新历史面板，避免阻塞UI
    requestAnimationFrame(() => {
      this.updateHistoryPanel();
    });
    
    console.log("历史面板已打开");
  }

  /**
   * 关闭历史面板
   */
  closeHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    panel.classList.remove('open');
    console.log("历史面板已关闭");
  }

  /**
   * 更新历史面板内容
   */
  updateHistoryPanel() {
    const statusElement = document.getElementById('history-status');
    const gridElement = document.getElementById('history-grid');
    
    if (!statusElement || !gridElement) return;

    const status = this.getHistoryStatus();
    
    // 更新状态信息
    statusElement.textContent = `历史记录：${status.length}/${status.maxSize} | 当前位置：${status.currentIndex === -1 ? '最新' : status.currentIndex + 1}`;

    // 使用优化器渲染历史面板
    if (this.historyPanelOptimizer) {
      this.historyPanelOptimizer.renderHistoryPanel(status.history, gridElement, status);
    } else {
      // 回退到原有方法
      this.renderHistoryPanelFallback(gridElement, status);
    }
  }

  /**
   * 回退的历史面板渲染方法
   * @param {HTMLElement} gridElement - 网格元素
   * @param {Object} status - 历史状态
   */
  renderHistoryPanelFallback(gridElement, status) {
    // 清空网格
    gridElement.innerHTML = '';

    if (status.length === 0) {
      // 显示空状态
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'history-empty';
      emptyDiv.innerHTML = `
        暂无浏览历史<br>
        <small>开始浏览图片后，历史记录将显示在这里</small>
      `;
      gridElement.appendChild(emptyDiv);
      return;
    }

    // 使用文档片段批量添加元素，提高性能
    const fragment = document.createDocumentFragment();

    // 创建历史项目
    status.history.forEach((imageUrl, index) => {
      const item = this.createHistoryItem(imageUrl, index, status);
      fragment.appendChild(item);
    });

    // 一次性添加所有元素
    gridElement.appendChild(fragment);
  }

  /**
   * 创建历史项目元素
   * @param {string} imageUrl - 图片URL
   * @param {number} index - 索引
   * @param {Object} status - 历史状态
   * @returns {HTMLElement} 历史项目元素
   */
  createHistoryItem(imageUrl, index, status) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    // 检查是否为当前图片
    const isCurrent = (status.currentIndex === -1 && index === status.length - 1) || 
                     (status.currentIndex === index);
    
    if (isCurrent) {
      item.classList.add('current');
    }

    // 创建图片容器
    const imgContainer = document.createElement('div');
    imgContainer.className = 'history-item-img-container';

    // 创建图片元素
    const img = document.createElement('img');
    img.alt = `历史图片 ${index + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    
    // 设置占位符
    img.style.backgroundColor = '#f0f0f0';
    img.style.minHeight = '80px';
    img.style.width = '100%';
    img.style.objectFit = 'cover';

    // 优化的图片加载
    this.loadHistoryImage(img, imageUrl, index);

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

    // 点击事件 - 跳转到指定图片
    item.addEventListener('click', () => {
      this.jumpToHistoryIndex(index);
    });

    imgContainer.appendChild(img);
    item.appendChild(imgContainer);
    item.appendChild(indexLabel);
    
    return item;
  }

  /**
   * 优化的历史图片加载
   * @param {HTMLImageElement} img - 图片元素
   * @param {string} imageUrl - 图片URL
   * @param {number} index - 索引
   */
  loadHistoryImage(img, imageUrl, index) {
    // 首先检查图片缓存
    const cachedImage = this.imageCache?.get(imageUrl);
    
    if (cachedImage) {
      cachedImage.then(cachedImg => {
        if (cachedImg) {
          img.src = cachedImg.src;
          img.style.backgroundColor = 'transparent';
          console.log(`历史图片 ${index + 1} 从缓存加载:`, imageUrl);
          return;
        }
        this.loadHistoryImageDirect(img, imageUrl, index);
      }).catch(() => {
        this.loadHistoryImageDirect(img, imageUrl, index);
      });
    } else {
      this.loadHistoryImageDirect(img, imageUrl, index);
    }
  }

  /**
   * 直接加载历史图片
   * @param {HTMLImageElement} img - 图片元素
   * @param {string} imageUrl - 图片URL
   * @param {number} index - 索引
   */
  loadHistoryImageDirect(img, imageUrl, index) {
    // 设置加载超时
    const loadTimeout = setTimeout(() => {
      if (!img.complete) {
        img.src = this.getPlaceholderImage();
        img.alt = '图片加载超时';
        console.warn(`历史图片 ${index + 1} 加载超时:`, imageUrl);
      }
    }, 3000);

    img.onload = () => {
      clearTimeout(loadTimeout);
      img.style.backgroundColor = 'transparent';
      
      // 异步缓存图片
      setTimeout(() => {
        this.imageCache?.set(imageUrl, img).catch(error => {
          console.warn('缓存历史图片失败:', error);
        });
      }, 100);
      
      console.log(`历史图片 ${index + 1} 加载完成:`, imageUrl);
    };
    
    img.onerror = () => {
      clearTimeout(loadTimeout);
      img.src = this.getPlaceholderImage();
      img.alt = '图片加载失败';
      console.warn(`历史图片 ${index + 1} 加载失败:`, imageUrl);
    };

    img.src = imageUrl;
  }

  /**
   * 获取占位符图片
   * @returns {string} 占位符图片的Data URL
   */
  getPlaceholderImage() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik00MCAyMEM0Ni42Mjc0IDIwIDUyIDI1LjM3MjYgNTIgMzJDNTIgMzguNjI3NCA0Ni42Mjc0IDQ0IDQwIDQ0QzMzLjM3MjYgNDQgMjggMzguNjI3NCAyOCAzMkMyOCAyNS4zNzI2IDMzLjM3MjYgMjAgNDAgMjBaIiBmaWxsPSIjY2NjIi8+CjxwYXRoIGQ9Ik0yMCA1Nkw2MCA1NkM2MiA1NiA2MCA1NCA2MCA1Mkw2MCA0OEM2MCA0NiA1OCA0NCA1NiA0NEwyNCA0NEMyMiA0NCAyMCA0NiAyMCA0OEwyMCA1MkMyMCA1NCAyMiA1NiAyMCA1NloiIGZpbGw9IiNjY2MiLz4KPC9zdmc+';
  }

  /**
   * 跳转到历史记录中的指定索引
   * @param {number} index - 历史记录索引
   */
  jumpToHistoryIndex(index) {
    if (index < 0 || index >= this.imageHistory.length) {
      console.warn("无效的历史索引:", index);
      return;
    }

    const targetUrl = this.imageHistory[index];
    console.log(`跳转到历史记录 ${index + 1}:`, targetUrl);

    // 更新当前历史索引
    if (index === this.imageHistory.length - 1) {
      this.currentHistoryIndex = -1; // 最新位置
    } else {
      this.currentHistoryIndex = index;
    }

    // 显示图片
    this.currentImageUrl = targetUrl;
    this.uiController.displayImage(targetUrl, this.responsiveManager);
    
    // 更新历史面板
    this.updateHistoryPanel();
    
    // 显示反馈
    this.uiController.showUserFeedback(`已跳转到第 ${index + 1} 张图片`, 1500);
  }

  /**
   * 显示历史状态信息（调试用）
   */
  showHistoryStatus() {
    const status = this.getHistoryStatus();
    const message = `历史: ${status.length}/${status.maxSize} | 位置: ${status.currentIndex === -1 ? '最新' : status.currentIndex} | 可返回: ${status.canGoPrevious ? '是' : '否'} | 可前进: ${status.canGoNext ? '是' : '否'}`;
    console.log("历史状态:", status);
    this.uiController.showUserFeedback(message, 2000);
  }

  /**
   * 获取历史记录状态
   * @returns {Object} 历史记录状态信息
   */
  getHistoryStatus() {
    return {
      length: this.imageHistory.length,
      maxSize: this.maxHistorySize,
      currentIndex: this.currentHistoryIndex,
      canGoPrevious: this.canGoPrevious(),
      canGoNext: this.canGoNext(),
      currentUrl: this.currentImageUrl,
      history: this.imageHistory,
    };
  }

  /**
   * 绑定帮助按钮事件
   */
  bindHelpButton() {
    const helpButton = document.getElementById("help-button");
    if (!helpButton) return;

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    let touchHandled = false;

    helpButton.addEventListener("touchstart", (event) => {
      event.preventDefault();
      touchHandled = true;
      helpButton.style.transform = "scale(0.95)";
    }, { passive: false });

    helpButton.addEventListener("touchend", (event) => {
      event.preventDefault();
      helpButton.style.transform = "scale(1)";
      setTimeout(() => this.handleHelpButtonClick(), 50);
    }, { passive: false });

    helpButton.addEventListener("click", (event) => {
      if (touchHandled) {
        touchHandled = false;
        return;
      }
      event.preventDefault();
      this.handleHelpButtonClick();
    });

    console.log("帮助按钮事件已绑定");
  }

  /**
   * 处理帮助按钮点击
   */
  handleHelpButtonClick() {
    try {
      this.uiController.showUserFeedback("正在显示操作指南...", 1000);

      if (this.userGuideManager) {
        this.userGuideManager.showGuide(true);
      } else {
        this.uiController.showUserFeedback("引导功能暂时不可用", 2000);
      }
    } catch (error) {
      console.error("显示帮助时发生错误:", error);
      this.uiController.showUserFeedback("显示帮助失败，请稍后重试", 2000);
    }
  }

  /**
   * 初始化用户引导功能
   */
  initializeUserGuideFeatures() {
    if (!this.userGuideManager) return;

    try {
      const success = this.userGuideManager.initialize();
      if (success) {
        console.log("用户引导功能初始化成功");
      }
      this.addHelpKeyboardShortcut();
    } catch (error) {
      console.error("用户引导功能初始化失败:", error);
    }
  }

  /**
   * 添加键盘快捷键支持
   */
  addHelpKeyboardShortcut() {
    const optimizedHelpKeyHandler = this.eventOptimizer?.throttle(
      (event) => {
        if (event.key === "F1") {
          event.preventDefault();
          this.handleHelpButtonClick();
        }
      },
      500,
      "help-shortcut"
    );

    if (optimizedHelpKeyHandler) {
      document.addEventListener("keydown", optimizedHelpKeyHandler);
      console.log("帮助快捷键已绑定 (F1)");
    }
  }

  /**
   * 获取下一张历史图片
   * @returns {string|null} 下一张图片URL或null
   */
  getNextFromHistory() {
    if (this.currentHistoryIndex === -1) {
      return null; // 已经在最新位置
    }

    this.currentHistoryIndex++;
    if (this.currentHistoryIndex >= this.imageHistory.length - 1) {
      this.currentHistoryIndex = -1; // 回到最新位置
      return null;
    }

    const nextUrl = this.imageHistory[this.currentHistoryIndex];
    console.log("从历史记录前进到下一张:", nextUrl, "索引:", this.currentHistoryIndex);
    return nextUrl;
  }

  /**
   * 检查是否可以前进到下一张
   * @returns {boolean} 是否可以前进
   */
  canGoNext() {
    if (this.currentHistoryIndex === -1) {
      return true; // 在最新位置，总是可以获取新图片
    }
    
    return this.currentHistoryIndex < this.imageHistory.length - 1;
  }

  /**
   * 显示历史图片（带动画）
   * @param {string} imageUrl - 历史图片URL
   * @param {string} direction - 动画方向
   */
  async displayHistoryImage(imageUrl, direction) {
    try {
      console.log(`显示历史图片: ${imageUrl}, 方向: ${direction}`);

      // 获取当前图片元素
      const currentImg = this.uiController.imageContainer?.querySelector("img");

      // 检查缓存
      let cachedImage = this.imageCache?.get(imageUrl);
      let newImg;

      if (cachedImage) {
        console.log("使用缓存的历史图片:", imageUrl);
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(true);
        }

        // 克隆缓存的图片
        newImg = cachedImage.cloneNode();

        // 调整图片尺寸
        if (this.responsiveManager) {
          this.responsiveManager.adjustImageSize(newImg);
        }
      } else {
        console.log("历史图片缓存未命中，重新加载:", imageUrl);
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(false);
        }

        // 预加载历史图片
        newImg = await this.preloadImageForAnimation(imageUrl);

        // 缓存历史图片
        try {
          await this.imageCache?.set(imageUrl, newImg);
        } catch (cacheError) {
          console.warn("历史图片缓存失败:", cacheError);
        }
      }

      // 执行动画切换
      if (this.animationController) {
        await this.executeImageSwitchAnimation(currentImg, newImg, direction);
      } else {
        // 简单切换
        this.uiController.clearImage();
        if (this.uiController.imageContainer) {
          this.uiController.imageContainer.appendChild(newImg);
        }
      }

      // 更新当前图片URL
      this.currentImageUrl = imageUrl;

      // 隐藏加载状态
      this.uiController.hideLoading();
      this.uiController.hideError();

      // 更新历史面板（如果已打开）
      const historyPanel = document.getElementById('history-panel');
      if (historyPanel && historyPanel.classList.contains('open')) {
        this.updateHistoryPanel();
      }

      console.log("历史图片显示完成:", imageUrl);
    } catch (error) {
      console.error("显示历史图片失败:", error);
      this.uiController.showUserFeedback("图片显示失败，请重试", 1000);
    }
  }

  /**
   * 预加载图片用于动画
   * @param {string} imageUrl - 图片URL
   * @returns {Promise<HTMLImageElement>} 加载完成的图片元素
   */
  async preloadImageForAnimation(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = document.createElement("img");

      img.onload = () => {
        console.log("动画图片预加载成功:", imageUrl);

        // 调整图片尺寸
        if (this.responsiveManager) {
          this.responsiveManager.adjustImageSize(img);
        }

        resolve(img);
      };

      img.onerror = () => {
        console.error("动画图片预加载失败:", imageUrl);
        reject(new Error("图片资源加载失败，可能图片已损坏或不存在"));
      };

      // 设置图片属性
      img.src = imageUrl;
      img.alt = "H5 图片展示";
    });
  }

  /**
   * 执行图片切换动画
   * @param {HTMLElement} currentImg - 当前图片元素
   * @param {HTMLElement} newImg - 新图片元素
   * @param {string} direction - 动画方向
   */
  async executeImageSwitchAnimation(currentImg, newImg, direction) {
    try {
      console.log(`执行图片切换动画，方向: ${direction}`);

      // 如果没有当前图片，直接显示新图片
      if (!currentImg) {
        console.log("没有当前图片，直接显示新图片");
        if (this.uiController.imageContainer) {
          this.uiController.imageContainer.appendChild(newImg);
        }

        // 添加简单的显示动画
        newImg.style.opacity = "0";
        newImg.style.transform = "scale(0.95)";
        newImg.style.transition = "opacity 0.3s ease, transform 0.3s ease";

        setTimeout(() => {
          newImg.style.opacity = "1";
          newImg.style.transform = "scale(1)";
        }, 50);

        return;
      }

      // 设置新图片的初始样式
      newImg.style.position = "absolute";
      newImg.style.top = "0";
      newImg.style.left = "0";
      newImg.style.opacity = "1";

      // 添加新图片到容器
      if (this.uiController.imageContainer) {
        this.uiController.imageContainer.appendChild(newImg);
      }

      // 执行滑动动画
      if (this.animationController) {
        await this.animationController.slideAnimation(currentImg, newImg, direction);
      }

      // 动画完成后清理旧图片
      if (currentImg && currentImg.parentNode) {
        currentImg.remove();
      }

      // 重置新图片样式
      newImg.style.position = "";
      newImg.style.top = "";
      newImg.style.left = "";
      newImg.style.transform = "";
      newImg.style.transition = "";

      console.log("图片切换动画执行完成");
    } catch (error) {
      console.error("图片切换动画执行失败:", error);

      // 动画失败时的回退处理
      this.handleAnimationFallback(currentImg, newImg);

      throw error;
    }
  }

  /**
   * 处理动画失败的回退
   * @param {HTMLElement} currentImg - 当前图片元素
   * @param {HTMLElement} newImg - 新图片元素
   */
  handleAnimationFallback(currentImg, newImg) {
    console.log("执行动画失败回退处理");

    try {
      // 清除当前图片
      if (currentImg && currentImg.parentNode) {
        currentImg.remove();
      }

      // 确保新图片在容器中
      if (newImg && !newImg.parentNode && this.uiController.imageContainer) {
        this.uiController.imageContainer.appendChild(newImg);
      }

      // 重置新图片样式
      if (newImg) {
        newImg.style.position = "";
        newImg.style.top = "";
        newImg.style.left = "";
        newImg.style.transform = "";
        newImg.style.transition = "";
        newImg.style.opacity = "1";
      }
    } catch (fallbackError) {
      console.error("动画回退处理也失败了:", fallbackError);
    }
  }

  /**
   * 带动画的图片加载
   * @param {string} direction - 动画方向
   */
  async loadImageWithAnimation(direction) {
    const startTime = performance.now();

    try {
      console.log(`开始带动画的图片加载，方向: ${direction}`);

      // 检查网络连接
      if (!this.apiService.isOnline()) {
        throw new Error("网络连接不可用，请检查网络设置");
      }

      // 获取当前图片元素
      const currentImg = this.uiController.imageContainer?.querySelector("img");

      // 显示加载状态（但不清除当前图片）
      this.uiController.showLoading();

      // 获取新图片URL
      const apiStartTime = performance.now();
      const imageUrl = await this.apiService.fetchImage();
      const apiEndTime = performance.now();

      // 记录API调用时间
      if (this.performanceMonitor) {
        this.performanceMonitor.recordApiCallTime(apiStartTime, apiEndTime, true);
      }

      // 检查缓存
      let cachedImage = this.imageCache?.get(imageUrl);
      let newImg;

      if (cachedImage) {
        console.log("使用缓存图片进行动画切换:", imageUrl);
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(true);
        }

        // 克隆缓存的图片
        newImg = cachedImage.cloneNode();

        // 调整图片尺寸
        if (this.responsiveManager) {
          this.responsiveManager.adjustImageSize(newImg);
        }

        // 执行动画切换
        await this.executeImageSwitchAnimation(currentImg, newImg, direction);
      } else {
        console.log("缓存未命中，加载新图片并执行动画:", imageUrl);
        if (this.performanceMonitor) {
          this.performanceMonitor.recordCacheHit(false);
        }

        // 预加载新图片
        newImg = await this.preloadImageForAnimation(imageUrl);

        // 缓存新图片
        try {
          await this.imageCache?.set(imageUrl, newImg);
        } catch (cacheError) {
          console.warn("图片缓存失败:", cacheError);
        }

        // 执行动画切换
        await this.executeImageSwitchAnimation(currentImg, newImg, direction);
      }

      // 隐藏加载状态
      this.uiController.hideLoading();
      this.uiController.hideError();

      // 记录内存使用情况
      if (this.performanceMonitor) {
        this.performanceMonitor.recordMemoryUsage(
          this.imageCache?.getStats()?.memoryUsage || 0
        );
      }

      // 触发智能预加载
      if (this.preloadStrategy) {
        this.preloadStrategy.smartPreload(imageUrl);
      }

      // 触发图片加载完成后的自动预加载
      if (this.preloadStrategy) {
        await this.preloadStrategy.preloadOnImageLoad(imageUrl);
      }

      // 更新当前图片URL
      this.currentImageUrl = imageUrl;

      const endTime = performance.now();
      console.log(`带动画的图片加载完成，总耗时: ${(endTime - startTime).toFixed(2)}ms`);
    } catch (error) {
      const endTime = performance.now();
      console.error("带动画的图片加载失败:", error);

      // 记录错误和失败的API调用
      if (this.performanceMonitor) {
        this.performanceMonitor.recordError(error, "loadImageWithAnimation");
        this.performanceMonitor.recordApiCallTime(startTime, endTime, false);
      }

      // 如果动画加载失败，回退到普通加载
      console.log("回退到普通图片加载");
      this.loadImage();
    }
  }

  /**
   * 获取当前显示的图片URL
   * @returns {string|null} 当前图片URL或null
   */
  getCurrentImageUrl() {
    return this.uiController.getCurrentImageUrl();
  }

  /**
   * 刷新当前图片
   */
  refreshImage() {
    console.log("刷新图片");
    this.loadImage();
  }

  /**
   * 获取性能报告
   * @returns {Object} 性能统计报告
   */
  getPerformanceReport() {
    return this.performanceMonitor?.getPerformanceReport() || {};
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return this.imageCache?.getStats() || {};
  }

  /**
   * 清理缓存
   */
  clearCache() {
    if (this.imageCache) {
      this.imageCache.clear();
      console.log("图片缓存已清理");
    }
  }

  /**
   * 输出性能报告到控制台
   */
  logPerformanceReport() {
    if (this.performanceMonitor) {
      this.performanceMonitor.logPerformanceReport();
    }

    const cacheStats = this.getCacheStats();
    console.group("📦 缓存统计");
    console.log("缓存数量:", (cacheStats.cacheSize || 0) + "/" + (cacheStats.maxCacheSize || 0));
    console.log("内存使用:", (cacheStats.memoryUsagePercent || 0) + "%");
    console.log("内存占用:", ((cacheStats.memoryUsage || 0) / 1024 / 1024).toFixed(2) + "MB");
    console.groupEnd();
  }

  /**
   * 销毁图片查看器，清理资源
   */
  destroy() {
    if (this.imageCache) {
      this.imageCache.clear();
    }

    if (this.preloadStrategy) {
      this.preloadStrategy.cleanup();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.cleanup();
    }

    if (this.eventOptimizer) {
      this.eventOptimizer.cleanup();
    }

    if (this.userGuideManager) {
      this.userGuideManager.destroy();
    }

    if (this.animationController) {
      this.animationController.destroy();
    }

    if (this.uiController) {
      this.uiController.destroy();
    }

    if (this.responsiveManager) {
      this.responsiveManager.destroy();
    }

    console.log("ImageViewer 已销毁");
  }
}
   * 初始化用户引导功能
   */
  initializeUserGuideFeatures() {
    if (!this.userGuideManager) return;

    try {
      const success = this.userGuideManager.initialize();
      if (success) {
        console.log("用户引导功能初始化成功");
      }
      this.addHelpKeyboardShortcut();
    } catch (error) {
      console.error("用户引导功能初始化失败:", error);
    }
  }

  /**
   * 添加键盘快捷键支持
   */
  addHelpKeyboardShortcut() {
    const optimizedHelpKeyHandler = this.eventOptimizer?.throttle(
      (event) => {
        if (event.key === "F1") {
          event.preventDefault();
          this.handleHelpButtonClick();
        }
      },
      500,
      "help-shortcut"
    );

    if (optimizedHelpKeyHandler) {
      document.addEventListener("keydown", optimizedHelpKeyHandler);
      console.log("帮助快捷键已绑定 (F1)");
    }
  }

  /**
   * 获取当前显示的图片URL
   * @returns {string|null} 当前图片URL或null
   */
  getCurrentImageUrl() {
    return this.uiController.getCurrentImageUrl();
  }

  /**
   * 刷新当前图片
   */
  refreshImage() {
    console.log("刷新图片");
    this.loadImage();
  }

  /**
   * 销毁图片查看器，清理资源
   */
  destroy() {
    if (this.imageCache) {
      this.imageCache.clear();
    }

    if (this.preloadStrategy) {
      this.preloadStrategy.cleanup();
    }

    if (this.performanceMonitor) {
      this.performanceMonitor.cleanup();
    }

    if (this.eventOptimizer) {
      this.eventOptimizer.cleanup();
    }

    if (this.userGuideManager) {
      this.userGuideManager.destroy();
    }

    if (this.animationController) {
      this.animationController.destroy();
    }

    if (this.uiController) {
      this.uiController.destroy();
    }

    if (this.responsiveManager) {
      this.responsiveManager.destroy();
    }

    console.log("ImageViewer 已销毁");
  }
}