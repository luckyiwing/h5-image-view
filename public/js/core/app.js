/**
 * 主应用类模块
 */

import { APP_CONFIG } from "../config/app-config.js";
import { ApiService } from "../services/api-service.js";
import { UIController } from "../controllers/ui-controller.js";
import { ImageViewer } from "./image-viewer.js";

/**
 * 主应用类 - 整合所有功能模块并管理应用生命周期
 */
export class H5ImageViewerApp {
  constructor() {
    console.log("H5ImageViewerApp 初始化开始");

    this.initializeState();
    this.setupGlobalErrorHandling();
    this.initializeModules();
    this.setupLifecycleManagement();
    this.bindGlobalEvents();

    console.log("H5ImageViewerApp 初始化完成");
  }

  /**
   * 初始化应用状态
   */
  initializeState() {
    this.state = {
      isInitialized: false,
      isDestroyed: false,
      currentModule: null,
      errorCount: 0,
      lastError: null,
      startTime: Date.now(),
      modules: {
        apiService: null,
        uiController: null,
        imageViewer: null,
        responsiveManager: null,
      },
    };

    this.config = {
      maxErrorCount: APP_CONFIG.error.maxErrorCount,
      errorResetTime: APP_CONFIG.error.errorResetTime,
      retryDelay: APP_CONFIG.error.retryDelay,
      enableDebugMode: false,
    };

    console.log("应用状态初始化完成");
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的Promise错误
    window.addEventListener("unhandledrejection", (event) => {
      console.error("未处理的Promise错误:", event.reason);
      this.handleGlobalError(event.reason, "unhandledrejection");
      event.preventDefault();
    });

    // 捕获全局JavaScript错误
    window.addEventListener("error", (event) => {
      console.error("全局JavaScript错误:", event.error);
      this.handleGlobalError(event.error, "javascript");
    });

    // 捕获资源加载错误
    window.addEventListener(
      "error",
      (event) => {
        if (event.target !== window) {
          console.error("资源加载错误:", event.target.src || event.target.href);
          this.handleGlobalError(new Error("资源加载失败"), "resource");
        }
      },
      true
    );

    console.log("全局错误处理已设置");
  }

  /**
   * 处理全局错误
   * @param {Error} error - 错误对象
   * @param {string} type - 错误类型
   */
  handleGlobalError(error, type = "unknown") {
    this.state.errorCount++;
    this.state.lastError = {
      error,
      type,
      timestamp: Date.now(),
      count: this.state.errorCount,
    };

    console.error(`全局错误处理 [${type}]:`, error);

    if (this.state.errorCount >= this.config.maxErrorCount) {
      this.enableFallbackMode();
      return;
    }

    this.attemptRecovery(error, type);

    setTimeout(() => {
      if (this.state.errorCount > 0) {
        this.state.errorCount = Math.max(0, this.state.errorCount - 1);
        console.log("错误计数已重置:", this.state.errorCount);
      }
    }, this.config.errorResetTime);
  }

  /**
   * 尝试从错误中恢复
   * @param {Error} error - 错误对象
   * @param {string} type - 错误类型
   */
  attemptRecovery(error, type) {
    console.log(`尝试从${type}错误中恢复:`, error.message);

    switch (type) {
      case "unhandledrejection":
        if (this.state.modules.apiService) {
          console.log("重新初始化API服务");
          this.reinitializeApiService();
        }
        break;

      case "javascript":
        if (error.message.includes("ImageViewer")) {
          console.log("重新初始化ImageViewer");
          this.reinitializeImageViewer();
        }
        break;

      case "resource":
        if (this.state.modules.uiController) {
          this.state.modules.uiController.showUserFeedback(
            "资源加载失败，请刷新页面",
            3000
          );
        }
        break;

      default:
        console.log("未知错误类型，执行通用恢复策略");
        this.performGeneralRecovery();
        break;
    }
  }

  /**
   * 启用降级模式
   */
  enableFallbackMode() {
    console.warn("错误次数过多，启用降级模式");
    this.showFallbackUI();
    this.disableAdvancedFeatures();
    this.provideFallbackOptions();
  }

  /**
   * 显示降级模式UI
   */
  showFallbackUI() {
    const fallbackHTML = `
      <div id="fallback-mode" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        font-family: Arial, sans-serif;
      ">
        <h2>应用遇到问题</h2>
        <p>应用运行时遇到多个错误，已切换到安全模式</p>
        <div style="margin-top: 20px;">
          <button id="fallback-reload" style="
            padding: 10px 20px;
            margin: 0 10px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">重新加载页面</button>
          <button id="fallback-continue" style="
            padding: 10px 20px;
            margin: 0 10px;
            background: #28a745;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          ">继续使用基本功能</button>
        </div>
        <div style="margin-top: 20px; font-size: 12px; opacity: 0.7;">
          错误次数: ${this.state.errorCount} | 最后错误: ${
      this.state.lastError?.error?.message || "未知"
    }
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", fallbackHTML);

    document.getElementById("fallback-reload").addEventListener("click", () => {
      window.location.reload();
    });

    document
      .getElementById("fallback-continue")
      .addEventListener("click", () => {
        document.getElementById("fallback-mode").remove();
        this.initializeBasicMode();
      });
  }

  /**
   * 禁用高级功能
   */
  disableAdvancedFeatures() {
    if (this.state.modules.imageViewer) {
      const container = document.getElementById("image-container");
      if (container) {
        container.style.touchAction = "auto";
      }
    }

    if (this.state.modules.responsiveManager) {
      this.state.modules.responsiveManager.destroy();
      this.state.modules.responsiveManager = null;
    }

    console.log("高级功能已禁用");
  }

  /**
   * 提供降级选项
   */
  provideFallbackOptions() {
    this.initializeBasicMode();
  }

  /**
   * 初始化基本模式
   */
  initializeBasicMode() {
    console.log("初始化基本模式");

    const basicApiService = {
      async fetchImage() {
        try {
          const response = await fetch("/api/image");
          if (!response.ok) throw new Error("API调用失败");
          const data = await response.json();
          return data.url;
        } catch (error) {
          throw new Error("无法获取图片，请稍后重试");
        }
      },
    };

    const basicUIController = {
      showImage(url) {
        const container = document.getElementById("image-container");
        if (container) {
          container.innerHTML = `<img src="${url}" alt="图片" style="max-width: 100%; max-height: 100vh;">`;
        }
      },
      showError(message) {
        const container = document.getElementById("image-container");
        if (container) {
          container.innerHTML = `
            <div style="text-align: center; padding: 20px;">
              <p>${message}</p>
              <button onclick="window.imageViewerApp.loadBasicImage()">重试</button>
            </div>
          `;
        }
      },
    };

    this.basicServices = {
      apiService: basicApiService,
      uiController: basicUIController,
    };

    this.loadBasicImage();
  }

  /**
   * 基本模式下加载图片
   */
  async loadBasicImage() {
    try {
      const url = await this.basicServices.apiService.fetchImage();
      this.basicServices.uiController.showImage(url);
    } catch (error) {
      this.basicServices.uiController.showError(error.message);
    }
  }

  /**
   * 重新初始化API服务
   */
  reinitializeApiService() {
    try {
      this.state.modules.apiService = new ApiService();
      console.log("API服务重新初始化成功");
    } catch (error) {
      console.error("API服务重新初始化失败:", error);
    }
  }

  /**
   * 重新初始化ImageViewer
   */
  reinitializeImageViewer() {
    try {
      if (this.state.modules.imageViewer) {
        this.state.modules.imageViewer = null;
      }

      this.state.modules.imageViewer = new ImageViewer();
      console.log("ImageViewer重新初始化成功");
    } catch (error) {
      console.error("ImageViewer重新初始化失败:", error);
    }
  }

  /**
   * 执行通用恢复策略
   */
  performGeneralRecovery() {
    this.cleanupResources();

    setTimeout(() => {
      this.reinitializeCore();
    }, this.config.retryDelay);
  }

  /**
   * 初始化所有模块
   */
  initializeModules() {
    try {
      console.log("开始初始化模块...");

      this.state.modules.apiService = new ApiService();
      console.log("✓ API服务初始化完成");

      this.state.modules.uiController = new UIController();
      console.log("✓ UI控制器初始化完成");

      this.state.modules.responsiveManager = new ResponsiveManager();
      console.log("✓ 响应式管理器初始化完成");

      this.state.modules.imageViewer = new ImageViewer();
      console.log("✓ 图片查看器初始化完成");

      this.state.isInitialized = true;
      console.log("所有模块初始化完成");

      this.setupPropertyAccessors();
    } catch (error) {
      console.error("模块初始化失败:", error);
      this.handleGlobalError(error, "initialization");
    }
  }

  /**
   * 设置便捷的属性访问器
   */
  setupPropertyAccessors() {
    // 直接暴露到应用实例的顶层，便于全局函数访问
    this.apiService = this.state.modules.apiService;
    this.uiController = this.state.modules.uiController;
    this.imageViewer = this.state.modules.imageViewer;
    this.responsiveManager = this.state.modules.responsiveManager;

    // 为了兼容性，也保持 state.modules 的访问方式
    // 这样旧的访问路径仍然有效
    console.log("属性访问器已设置");
    console.log("ImageViewer实例:", this.imageViewer ? "已创建" : "未创建");
  }

  /**
   * 加载图片的便捷方法
   */
  loadImage() {
    if (this.imageViewer && typeof this.imageViewer.loadImage === "function") {
      return this.imageViewer.loadImage();
    } else {
      console.error("ImageViewer未初始化或loadImage方法不存在");
    }
  }

  /**
   * 设置生命周期管理
   */
  setupLifecycleManagement() {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });

    window.addEventListener("beforeunload", () => {
      this.handleBeforeUnload();
    });

    window.addEventListener("unload", () => {
      this.destroy();
    });

    console.log("生命周期管理已设置");
  }

  /**
   * 处理页面隐藏
   */
  handlePageHidden() {
    console.log("页面已隐藏，暂停非必要操作");
  }

  /**
   * 处理页面显示
   */
  handlePageVisible() {
    console.log("页面已显示，恢复操作");
  }

  /**
   * 处理页面卸载前
   */
  handleBeforeUnload() {
    console.log("页面即将卸载，保存状态");

    try {
      const stateToSave = {
        errorCount: this.state.errorCount,
        lastError: this.state.lastError,
        timestamp: Date.now(),
      };
      localStorage.setItem(
        "h5-image-viewer-state",
        JSON.stringify(stateToSave)
      );
    } catch (error) {
      console.warn("无法保存状态到localStorage:", error);
    }
  }

  /**
   * 绑定全局事件
   */
  bindGlobalEvents() {
    window.addEventListener("online", () => {
      console.log("网络已连接");
      this.handleNetworkOnline();
    });

    window.addEventListener("offline", () => {
      console.log("网络已断开");
      this.handleNetworkOffline();
    });

    if ("memory" in performance) {
      setInterval(() => {
        this.checkMemoryUsage();
      }, 30000);
    }

    console.log("全局事件已绑定");
  }

  /**
   * 处理网络连接
   */
  handleNetworkOnline() {
    if (this.state.modules.uiController) {
      this.state.modules.uiController.showUserFeedback("网络已恢复", 2000);
    }

    if (
      this.state.modules.imageViewer &&
      this.state.modules.uiController.isErrorState()
    ) {
      setTimeout(() => {
        this.state.modules.imageViewer.loadImage();
      }, 1000);
    }
  }

  /**
   * 处理网络断开
   */
  handleNetworkOffline() {
    if (this.state.modules.uiController) {
      this.state.modules.uiController.showUserFeedback("网络连接已断开", 3000);
    }
  }

  /**
   * 检查内存使用情况
   */
  checkMemoryUsage() {
    if ("memory" in performance) {
      const memory = performance.memory;
      const usedMB = Math.round(memory.usedJSHeapSize / 1024 / 1024);
      const limitMB = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
      const usagePercent = (usedMB / limitMB) * 100;

      console.log(
        `内存使用: ${usedMB}MB / ${limitMB}MB (${usagePercent.toFixed(1)}%)`
      );

      if (usagePercent > 80) {
        console.warn("内存使用过高，执行清理");
        this.cleanupResources();
      }
    }
  }

  /**
   * 清理资源
   */
  cleanupResources() {
    console.log("开始清理资源");

    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (img.src && img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
    });

    if (window.gc) {
      window.gc();
    }

    console.log("资源清理完成");
  }

  /**
   * 重新初始化核心模块
   */
  reinitializeCore() {
    console.log("重新初始化核心模块");

    try {
      if (!this.state.modules.apiService) {
        this.state.modules.apiService = new ApiService();
      }

      if (!this.state.modules.uiController) {
        this.state.modules.uiController = new UIController();
      }

      console.log("核心模块重新初始化完成");
    } catch (error) {
      console.error("核心模块重新初始化失败:", error);
    }
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态信息
   */
  getAppState() {
    return {
      ...this.state,
      uptime: Date.now() - this.state.startTime,
      memoryUsage: performance.memory
        ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
          }
        : null,
    };
  }

  /**
   * 获取模块实例
   * @param {string} moduleName - 模块名称
   * @returns {Object|null} 模块实例
   */
  getModule(moduleName) {
    return this.state.modules[moduleName] || null;
  }

  /**
   * 启用调试模式
   */
  enableDebugMode() {
    this.config.enableDebugMode = true;
    console.log("调试模式已启用");

    window.debugInfo = {
      appState: () => this.getAppState(),
      modules: this.state.modules,
      config: this.config,
      cleanupResources: () => this.cleanupResources(),
      reinitializeCore: () => this.reinitializeCore(),
    };
  }

  /**
   * 销毁应用
   */
  destroy() {
    if (this.state.isDestroyed) {
      return;
    }

    console.log("开始销毁应用");

    Object.keys(this.state.modules).forEach((moduleName) => {
      const module = this.state.modules[moduleName];
      if (module && typeof module.destroy === "function") {
        try {
          module.destroy();
          console.log(`✓ ${moduleName} 已销毁`);
        } catch (error) {
          console.error(`${moduleName} 销毁失败:`, error);
        }
      }
    });

    this.cleanupResources();

    window.removeEventListener("online", this.handleNetworkOnline);
    window.removeEventListener("offline", this.handleNetworkOffline);

    this.state.isDestroyed = true;

    console.log("应用销毁完成");
  }
}
