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