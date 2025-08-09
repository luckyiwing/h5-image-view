/**
 * UI控制器模块
 */

import { APP_CONFIG, UI_STATES } from '../config/app-config.js';
import { errorHandler } from '../utils/error-handler.js';

/**
 * UI控制器类 - 管理界面状态和用户反馈
 */
export class UIController {
  constructor() {
    this.initializeElements();
    this.initializeState();
    this.setupProgressTracking();
  }

  /**
   * 初始化DOM元素引用
   */
  initializeElements() {
    this.imageContainer = document.getElementById("image-container");
    this.loadingIndicator = document.getElementById("loading-indicator");
    this.errorMessage = document.getElementById("error-message");
    this.retryBtn = document.getElementById("retry-btn");
    this.errorText = this.errorMessage?.querySelector("p");
    this.loadingText = this.loadingIndicator?.querySelector("p");
    this.spinner = this.loadingIndicator?.querySelector(".spinner");
  }

  /**
   * 初始化UI状态
   */
  initializeState() {
    this.currentState = UI_STATES.IDLE;
    this.loadingStartTime = null;
    this.progressTimer = null;
    this.feedbackTimer = null;
  }

  /**
   * 设置进度跟踪
   */
  setupProgressTracking() {
    this.progressMessages = [
      { time: 0, message: "正在获取图片..." },
      { time: 2000, message: "网络较慢，请稍候..." },
      { time: 5000, message: "仍在加载中，请耐心等待..." },
      { time: 10000, message: "网络连接可能有问题，正在重试..." },
    ];
  }

  /**
   * 显示加载状态
   * @param {string} message - 自定义加载消息
   */
  showLoading(message = "加载中...") {
    this.currentState = UI_STATES.LOADING;
    this.loadingStartTime = Date.now();

    if (this.loadingText) {
      this.loadingText.textContent = message;
    }

    if (this.loadingIndicator) {
      this.loadingIndicator.classList.remove("hidden");
    }
    
    this.hideError();

    if (this.spinner) {
      this.spinner.style.animation = "spin 1s linear infinite";
    }

    this.startProgressTracking();
    console.log("显示加载指示器:", message);
  }

  /**
   * 开始进度跟踪
   */
  startProgressTracking() {
    this.clearProgressTimer();

    this.progressTimer = setInterval(() => {
      if (this.currentState !== UI_STATES.LOADING) {
        this.clearProgressTimer();
        return;
      }

      const elapsedTime = Date.now() - this.loadingStartTime;
      const progressMessage = this.getProgressMessage(elapsedTime);

      if (progressMessage) {
        this.updateLoadingMessage(progressMessage);
      }
    }, APP_CONFIG.ui.progressUpdateInterval);
  }

  /**
   * 获取进度消息
   * @param {number} elapsedTime - 已经过的时间
   * @returns {string|null} 进度消息
   */
  getProgressMessage(elapsedTime) {
    for (let i = this.progressMessages.length - 1; i >= 0; i--) {
      const progress = this.progressMessages[i];
      if (elapsedTime >= progress.time) {
        return progress.message;
      }
    }
    return null;
  }

  /**
   * 更新加载消息
   * @param {string} message - 新的加载消息
   */
  updateLoadingMessage(message) {
    if (this.loadingText && this.loadingText.textContent !== message) {
      this.loadingText.textContent = message;

      this.loadingText.style.opacity = "0.7";
      setTimeout(() => {
        if (this.loadingText) {
          this.loadingText.style.opacity = "1";
        }
      }, 200);

      console.log("更新加载消息:", message);
    }
  }

  /**
   * 清除进度定时器
   */
  clearProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * 隐藏加载状态
   */
  hideLoading() {
    this.currentState = UI_STATES.LOADED;
    this.clearProgressTimer();

    if (this.loadingIndicator) {
      this.loadingIndicator.style.opacity = "0";

      setTimeout(() => {
        if (this.loadingIndicator) {
          this.loadingIndicator.classList.add("hidden");
          this.loadingIndicator.style.opacity = "1";
        }
      }, 300);
    }

    console.log("隐藏加载指示器");
  }

  /**
   * 显示错误信息
   * @param {Error} error - 错误对象
   * @param {Function} retryCallback - 重试回调函数
   */
  showError(error, retryCallback = null) {
    this.currentState = UI_STATES.ERROR;
    this.hideLoading();
    this.clearImage();

    const userMessage = errorHandler.getUserFriendlyMessage(error);
    
    if (this.errorText) {
      this.errorText.textContent = userMessage;
    }

    if (retryCallback && this.retryBtn) {
      this.retryBtn.onclick = () => {
        this.showUserFeedback("正在重试...");
        retryCallback();
      };
    }

    if (this.errorMessage) {
      this.errorMessage.classList.remove("hidden");

      this.errorMessage.style.transform = "translate(-50%, -50%) scale(0.9)";
      this.errorMessage.style.opacity = "0";

      setTimeout(() => {
        if (this.errorMessage) {
          this.errorMessage.style.transform = "translate(-50%, -50%) scale(1)";
          this.errorMessage.style.opacity = "1";
        }
      }, 100);
    }

    console.log("显示错误信息:", userMessage);
  }

  /**
   * 隐藏错误信息
   */
  hideError() {
    if (this.errorMessage) {
      this.errorMessage.classList.add("hidden");
    }
  }

  /**
   * 显示用户操作反馈
   * @param {string} message - 反馈消息
   * @param {number} duration - 显示时长（毫秒）
   */
  showUserFeedback(message, duration = APP_CONFIG.ui.feedbackDuration) {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    let feedbackElement = document.getElementById("user-feedback");
    if (!feedbackElement) {
      feedbackElement = document.createElement("div");
      feedbackElement.id = "user-feedback";
      feedbackElement.className = "user-feedback";
      document.getElementById("app")?.appendChild(feedbackElement);
    }

    feedbackElement.textContent = message;
    feedbackElement.classList.remove("hidden");

    feedbackElement.style.opacity = "0";
    feedbackElement.style.transform = "translateY(20px)";

    setTimeout(() => {
      feedbackElement.style.opacity = "1";
      feedbackElement.style.transform = "translateY(0)";
    }, 50);

    this.feedbackTimer = setTimeout(() => {
      feedbackElement.style.opacity = "0";
      feedbackElement.style.transform = "translateY(-20px)";

      setTimeout(() => {
        feedbackElement.classList.add("hidden");
      }, 300);
    }, duration);

    console.log("显示用户反馈:", message);
  }

  /**
   * 显示图片切换反馈
   * @param {string} direction - 切换方向 ('next' 或 'previous')
   */
  showSwitchFeedback(direction) {
    const message = direction === "next" ? "下一张" : "上一张";
    this.showUserFeedback(message, 800);
  }

  /**
   * 显示图片
   * @param {string} imageUrl - 图片URL
   * @param {Object} responsiveManager - 响应式管理器实例
   * @returns {Promise<void>}
   */
  async displayImage(imageUrl, responsiveManager = null) {
    return new Promise((resolve, reject) => {
      this.clearImage();

      const img = document.createElement("img");
      let isResolved = false;

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.error("图片加载超时:", imageUrl);
          reject(new Error("图片加载超时，请重试"));
        }
      }, APP_CONFIG.ui.loadingTimeout);

      img.onload = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);

        console.log("图片资源加载成功:", imageUrl);

        if (responsiveManager) {
          responsiveManager.adjustImageSize(img);
        }

        img.style.opacity = "0";
        img.style.transform = "scale(0.95)";

        setTimeout(() => {
          img.style.opacity = "1";
          img.style.transform = "scale(1)";
        }, 50);

        this.hideLoading();
        this.hideError();
        resolve();
      };

      img.onerror = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);

        console.error("图片资源加载失败:", imageUrl);
        reject(new Error("图片资源加载失败，可能图片已损坏或不存在"));
      };

      img.src = imageUrl;
      img.alt = "H5 图片展示";
      img.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      if (this.imageContainer) {
        this.imageContainer.appendChild(img);
      }
    });
  }

  /**
   * 清除当前显示的图片
   */
  clearImage() {
    if (this.imageContainer) {
      const existingImg = this.imageContainer.querySelector("img");
      if (existingImg) {
        existingImg.style.opacity = "0";
        setTimeout(() => {
          existingImg.remove();
        }, 200);
      }
    }
  }

  /**
   * 检查当前是否处于错误状态
   * @returns {boolean} 是否处于错误状态
   */
  isErrorState() {
    return this.currentState === UI_STATES.ERROR;
  }

  /**
   * 检查当前是否处于加载状态
   * @returns {boolean} 是否处于加载状态
   */
  isLoadingState() {
    return this.currentState === UI_STATES.LOADING;
  }

  /**
   * 获取当前UI状态
   * @returns {string} 当前状态
   */
  getCurrentState() {
    return this.currentState;
  }

  /**
   * 获取当前显示的图片URL
   * @returns {string|null} 当前图片URL或null
   */
  getCurrentImageUrl() {
    if (this.imageContainer) {
      const img = this.imageContainer.querySelector("img");
      return img ? img.src : null;
    }
    return null;
  }

  /**
   * 销毁UI控制器，清理资源
   */
  destroy() {
    this.clearProgressTimer();

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    const feedbackElement = document.getElementById("user-feedback");
    if (feedbackElement) {
      feedbackElement.remove();
    }
  }
}