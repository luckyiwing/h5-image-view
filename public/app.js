// H5 图片展示器主应用文件

/**
 * API服务模块 - 处理与后端代理的通信
 */
class ApiService {
  constructor() {
    this.proxyEndpoint = "/api/image";
    this.redirectEndpoint = "/api/image/redirect";
    this.currentEndpoint = this.redirectEndpoint; // 默认使用新的重定向API
    this.customEndpoint = null; // 自定义API端点
    this.customJsonPath = null; // 自定义JSON路径
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1秒
    this.compatibility = window.browserCompatibility;
    this.errorCategories = this.initializeErrorCategories();

    // 新增：API调用优化
    this.lastApiCall = 0;
    this.minApiInterval = 1500; // 最小API调用间隔1.5秒
    this.pendingRequests = new Map(); // 请求去重
    this.requestQueue = []; // 请求队列
    this.isProcessingQueue = false;

    this.loadCustomApiConfig(); // 加载自定义API配置
  }

  /**
   * 初始化错误分类
   * @returns {Object} 错误分类对象
   */
  initializeErrorCategories() {
    return {
      NETWORK_ERROR: "network",
      TIMEOUT_ERROR: "timeout",
      SERVER_ERROR: "server",
      PARSE_ERROR: "parse",
      VALIDATION_ERROR: "validation",
      COMPATIBILITY_ERROR: "compatibility",
      UNKNOWN_ERROR: "unknown",
    };
  }

  /**
   * 切换API源
   * @param {string} source - API源 ('default' 或 'redirect')
   */
  switchApiSource(source = "default") {
    if (source === "redirect") {
      this.currentEndpoint = this.redirectEndpoint;
      console.log("已切换到重定向API:", this.currentEndpoint);
    } else {
      this.currentEndpoint = this.proxyEndpoint;
      console.log("已切换到默认API:", this.currentEndpoint);
    }
  }

  /**
   * 优化的获取图片URL - 带去重和频率控制
   * @returns {Promise<string>} 图片URL
   */
  async fetchImage() {
    // 检查API调用频率限制
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    if (timeSinceLastCall < this.minApiInterval) {
      const waitTime = this.minApiInterval - timeSinceLastCall;
      console.log(`API调用频率限制，等待 ${waitTime}ms`);
      await this.delay(waitTime);
    }

    // 检查是否有相同的请求正在进行
    const requestKey = this.currentEndpoint;
    if (this.pendingRequests.has(requestKey)) {
      console.log("检测到重复请求，等待现有请求完成");
      return await this.pendingRequests.get(requestKey);
    }

    // 创建新的请求Promise
    const requestPromise = this.executeApiRequest();
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      const result = await requestPromise;
      this.lastApiCall = Date.now();
      return result;
    } finally {
      this.pendingRequests.delete(requestKey);
    }
  }

  /**
   * 执行实际的API请求
   * @returns {Promise<string>} 图片URL
   */
  async executeApiRequest() {
    let lastError;

    // 检查浏览器兼容性
    if (!this.compatibility.supports("fetch")) {
      console.warn("浏览器不支持Fetch API，使用兼容模式");
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // 为API URL添加随机参数以避免缓存
        let apiUrl = this.currentEndpoint;
        if (this.isUsingCustomApi()) {
          // 为自定义API添加随机参数
          const separator = apiUrl.includes('?') ? '&' : '?';
          apiUrl = `${apiUrl}${separator}t=${Date.now()}&r=${Math.random().toString(36).substr(2, 9)}`;
        }
        
        console.log(
          `API调用尝试 ${attempt}/${this.maxRetries} (端点: ${apiUrl})`
        );

        // 使用兼容的超时信号 - 减少到5秒
        const timeoutSignal = this.compatibility.createTimeoutSignal(5000);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: timeoutSignal,
        });

        if (!response.ok) {
          const error = new Error(
            `HTTP错误: ${response.status} ${response.statusText}`
          );
          error.category = this.errorCategories.SERVER_ERROR;
          error.statusCode = response.status;
          throw error;
        }

        const data = await response.json();
        const imageUrl = this.validateResponse(data);

        console.log("API调用成功，获取图片URL:", imageUrl);
        return imageUrl;
      } catch (error) {
        lastError = this.categorizeError(error);
        console.warn(
          `API调用失败 (尝试 ${attempt}/${this.maxRetries}):`,
          error.message
        );

        // 如果是第一次尝试失败且使用默认API，尝试切换到重定向API
        if (attempt === 1 && this.currentEndpoint === this.proxyEndpoint) {
          console.log("默认API失败，尝试切换到重定向API");
          this.switchApiSource("redirect");
          continue; // 重新尝试，不计入重试次数
        }

        // 根据错误类型决定是否重试
        if (!this.shouldRetry(lastError, attempt)) {
          break;
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < this.maxRetries) {
          const delay = this.calculateRetryDelay(attempt, lastError);
          await this.delay(delay);
        }
      }
    }

    // 所有重试都失败了
    throw this.handleApiError(lastError);
  }

  /**
   * 验证API响应数据格式
   * @param {Object} response - API响应数据
   * @returns {string} 验证后的图片URL
   */
  validateResponse(response) {
    if (!response || typeof response !== "object") {
      throw new Error("API响应格式无效：响应不是有效的JSON对象");
    }

    // 如果使用自定义API，使用自定义JSON路径提取URL
    if (this.isUsingCustomApi() && this.customJsonPath) {
      return this.extractImageUrlFromJson(response, this.customJsonPath);
    }

    // 默认API验证逻辑
    if (response.code !== undefined && response.code !== 200) {
      throw new Error(
        `API返回错误码: ${response.code}, 消息: ${response.msg || "未知错误"}`
      );
    }

    if (!response.url || typeof response.url !== "string") {
      throw new Error("API响应格式无效：缺少有效的图片URL");
    }

    // 验证URL格式
    try {
      new URL(response.url);
    } catch {
      throw new Error("API返回的图片URL格式无效");
    }

    return response.url;
  }

  /**
   * 处理API错误
   * @param {Error} error - 原始错误
   * @returns {Error} 处理后的错误
   */
  handleApiError(error) {
    if (error.name === "AbortError") {
      return new Error("请求超时，请检查网络连接");
    }

    if (error.name === "TypeError" && error.message.includes("fetch")) {
      return new Error("网络连接失败，请检查网络状态");
    }

    if (error.message.includes("HTTP错误")) {
      return new Error(`服务器错误: ${error.message}`);
    }

    // 返回原始错误或包装后的错误
    return error instanceof Error ? error : new Error("未知的API错误");
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
   * 检查网络连接状态
   * @returns {boolean} 是否在线
   */
  isOnline() {
    return navigator.onLine;
  }

  /**
   * 对错误进行分类
   * @param {Error} error - 原始错误
   * @returns {Error} 分类后的错误
   */
  categorizeError(error) {
    // 为错误添加分类信息
    if (error.name === "AbortError") {
      error.category = this.errorCategories.TIMEOUT_ERROR;
    } else if (error.name === "TypeError" && error.message.includes("fetch")) {
      error.category = this.errorCategories.NETWORK_ERROR;
    } else if (error.message.includes("HTTP错误")) {
      error.category = this.errorCategories.SERVER_ERROR;
    } else if (
      error.message.includes("API响应格式无效") ||
      error.message.includes("JSON")
    ) {
      error.category = this.errorCategories.PARSE_ERROR;
    } else if (error.message.includes("URL格式无效")) {
      error.category = this.errorCategories.VALIDATION_ERROR;
    } else if (!this.compatibility.supports("fetch")) {
      error.category = this.errorCategories.COMPATIBILITY_ERROR;
    } else {
      error.category = this.errorCategories.UNKNOWN_ERROR;
    }

    return error;
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @param {number} attempt - 当前尝试次数
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error, attempt) {
    // 达到最大重试次数
    if (attempt >= this.maxRetries) {
      return false;
    }

    // 根据错误类型决定是否重试
    switch (error.category) {
      case this.errorCategories.NETWORK_ERROR:
      case this.errorCategories.TIMEOUT_ERROR:
        return true; // 网络和超时错误可以重试

      case this.errorCategories.SERVER_ERROR:
        // 5xx错误可以重试，4xx错误不重试
        return error.statusCode >= 500;

      case this.errorCategories.PARSE_ERROR:
      case this.errorCategories.VALIDATION_ERROR:
      case this.errorCategories.COMPATIBILITY_ERROR:
        return false; // 这些错误重试无意义

      default:
        return true; // 未知错误默认重试
    }
  }

  /**
   * 计算重试延迟时间
   * @param {number} attempt - 当前尝试次数
   * @param {Error} error - 错误对象
   * @returns {number} 延迟时间（毫秒）
   */
  calculateRetryDelay(attempt, error) {
    let baseDelay = this.retryDelay;

    // 根据错误类型调整延迟
    switch (error.category) {
      case this.errorCategories.NETWORK_ERROR:
        baseDelay *= 2; // 网络错误延迟更长
        break;
      case this.errorCategories.SERVER_ERROR:
        baseDelay *= 1.5; // 服务器错误适中延迟
        break;
      default:
        break;
    }

    // 指数退避策略
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * 获取错误的用户友好消息
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  getErrorMessage(error) {
    const errorMessages = {
      请求超时: "网络连接超时，请稍后重试",
      网络连接失败: "无法连接到服务器，请检查网络",
      "HTTP错误: 404": "图片服务暂时不可用",
      "HTTP错误: 500": "服务器内部错误，请稍后重试",
      API响应格式无效: "服务器返回数据格式错误",
      API返回的图片URL格式无效: "获取到的图片地址无效",
    };

    for (const [key, message] of Object.entries(errorMessages)) {
      if (error.message.includes(key)) {
        return message;
      }
    }

    return "获取图片失败，请稍后重试";
  }

  /**
   * 加载自定义API配置
   */
  loadCustomApiConfig() {
    try {
      const config = localStorage.getItem("custom-api-config");
      if (config) {
        const parsed = JSON.parse(config);
        this.customEndpoint = parsed.url;
        this.customJsonPath = parsed.jsonPath;
        console.log("已加载自定义API配置:", parsed);
        
        // 自动切换到自定义API
        this.switchToCustomApi();
        console.log("已自动切换到自定义API");
      }
    } catch (error) {
      console.error("加载自定义API配置失败:", error);
    }
  }

  /**
   * 保存自定义API配置
   * @param {string} url - API URL
   * @param {string} jsonPath - JSON路径
   */
  saveCustomApiConfig(url, jsonPath) {
    try {
      const config = { url, jsonPath };
      localStorage.setItem("custom-api-config", JSON.stringify(config));
      this.customEndpoint = url;
      this.customJsonPath = jsonPath;
      console.log("已保存自定义API配置:", config);
    } catch (error) {
      console.error("保存自定义API配置失败:", error);
      throw new Error("保存配置失败");
    }
  }

  /**
   * 切换到自定义API
   */
  switchToCustomApi() {
    if (!this.customEndpoint || !this.customJsonPath) {
      throw new Error("自定义API配置不完整");
    }
    this.currentEndpoint = this.customEndpoint;
    console.log("已切换到自定义API:", this.currentEndpoint);
  }

  /**
   * 检查是否使用自定义API
   * @returns {boolean} 是否使用自定义API
   */
  isUsingCustomApi() {
    return this.currentEndpoint === this.customEndpoint;
  }

  /**
   * 从JSON响应中提取图片URL
   * @param {Object} response - API响应数据
   * @param {string} jsonPath - JSON路径
   * @returns {string} 图片URL
   */
  extractImageUrlFromJson(response, jsonPath) {
    if (!jsonPath) {
      throw new Error("JSON路径未指定");
    }

    try {
      // 调试：打印完整的API响应
      console.log("API响应数据:", JSON.stringify(response, null, 2));
      console.log("JSON路径:", jsonPath);

      // 支持简单的点分割路径，如 "data.url" 或 "result.image"
      const pathParts = jsonPath.split(".");
      let value = response;

      for (const part of pathParts) {
        if (value === null || value === undefined) {
          throw new Error(`JSON路径 "${jsonPath}" 中的 "${part}" 不存在`);
        }
        value = value[part];
      }

      // 如果原路径失败，尝试常见的嵌套路径
      if (value === undefined && jsonPath === "pic") {
        console.log("原路径失败，尝试常见的嵌套路径...");
        const commonPaths = ["数据.pic", "data.pic", "result.pic", "response.pic"];
        
        for (const altPath of commonPaths) {
          try {
            const altPathParts = altPath.split(".");
            let altValue = response;
            
            for (const part of altPathParts) {
              if (altValue === null || altValue === undefined) {
                break;
              }
              altValue = altValue[part];
            }
            
            if (altValue && typeof altValue === "string") {
              console.log(`找到有效路径: ${altPath}`);
              value = altValue;
              
              // 自动更新配置中的JSON路径
              if (this.customJsonPath === "pic") {
                console.log("自动更新JSON路径配置");
                this.customJsonPath = altPath;
                this.saveCustomApiConfig(this.customEndpoint, altPath);
              }
              break;
            }
          } catch (e) {
            // 继续尝试下一个路径
          }
        }
      }

      // 调试：打印提取到的值和类型
      console.log("提取到的值:", value);
      console.log("值的类型:", typeof value);

      // 如果值是数组，尝试获取第一个元素
      if (Array.isArray(value) && value.length > 0) {
        console.log("检测到数组，尝试获取第一个元素");
        value = value[0];
        console.log("数组第一个元素:", value, "类型:", typeof value);
      }

      // 如果值是对象，尝试查找常见的URL字段
      if (typeof value === "object" && value !== null) {
        console.log("检测到对象，尝试查找URL字段");
        const urlFields = ['url', 'src', 'link', 'href', 'image', 'pic'];
        for (const field of urlFields) {
          if (value[field] && typeof value[field] === 'string') {
            console.log(`在对象中找到URL字段 "${field}":`, value[field]);
            value = value[field];
            break;
          }
        }
      }

      // 如果值仍然不是字符串，尝试转换
      if (typeof value !== "string") {
        // 如果是数字，转换为字符串
        if (typeof value === "number") {
          console.log("将数字转换为字符串");
          value = String(value);
        } else {
          throw new Error(`JSON路径 "${jsonPath}" 指向的值不是字符串，实际类型: ${typeof value}，值: ${JSON.stringify(value)}`);
        }
      }

      // 处理转义字符，特别是 \/ 转义
      const cleanedUrl = value.replace(/\\\//g, '/');
      console.log("原始URL:", value);
      console.log("处理后URL:", cleanedUrl);

      // 验证URL格式
      try {
        new URL(cleanedUrl);
      } catch {
        throw new Error(`提取的值不是有效的URL: ${cleanedUrl}`);
      }

      return cleanedUrl;
    } catch (error) {
      throw new Error(`从JSON中提取图片URL失败: ${error.message}`);
    }
  }
}

/**
 * UI控制器类 - 管理界面状态和用户反馈
 */
class UIController {
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
    this.errorText = this.errorMessage.querySelector("p");
    this.loadingText = this.loadingIndicator.querySelector("p");
    this.spinner = this.loadingIndicator.querySelector(".spinner");
  }

  /**
   * 初始化UI状态
   */
  initializeState() {
    this.currentState = "idle"; // idle, loading, loaded, error
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
    this.currentState = "loading";
    this.loadingStartTime = Date.now();

    // 更新加载文本
    this.loadingText.textContent = message;

    // 显示加载指示器
    this.loadingIndicator.classList.remove("hidden");
    this.hideError();

    // 添加加载动画效果
    this.spinner.style.animation = "spin 1s linear infinite";

    // 开始进度跟踪
    this.startProgressTracking();

    console.log("显示加载指示器:", message);
  }

  /**
   * 开始进度跟踪
   */
  startProgressTracking() {
    // 清除之前的定时器
    this.clearProgressTimer();

    // 设置进度更新定时器
    this.progressTimer = setInterval(() => {
      if (this.currentState !== "loading") {
        this.clearProgressTimer();
        return;
      }

      const elapsedTime = Date.now() - this.loadingStartTime;
      const progressMessage = this.getProgressMessage(elapsedTime);

      if (progressMessage) {
        this.updateLoadingMessage(progressMessage);
      }
    }, 1000); // 每秒检查一次
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
    if (this.loadingText.textContent !== message) {
      this.loadingText.textContent = message;

      // 添加消息更新的视觉反馈
      this.loadingText.style.opacity = "0.7";
      setTimeout(() => {
        this.loadingText.style.opacity = "1";
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
    this.currentState = "loaded";
    this.clearProgressTimer();

    // 添加淡出效果
    this.loadingIndicator.style.opacity = "0";

    setTimeout(() => {
      this.loadingIndicator.classList.add("hidden");
      this.loadingIndicator.style.opacity = "1";
    }, 300);

    console.log("隐藏加载指示器");
  }

  /**
   * 显示错误信息
   * @param {Error} error - 错误对象
   * @param {Function} retryCallback - 重试回调函数
   */
  showError(error, retryCallback = null) {
    this.currentState = "error";
    this.hideLoading();
    this.clearImage();

    // 获取用户友好的错误消息
    const userMessage = this.getErrorMessage(error);
    this.errorText.textContent = userMessage;

    // 设置重试回调
    if (retryCallback) {
      this.retryBtn.onclick = () => {
        this.showUserFeedback("正在重试...");
        retryCallback();
      };
    }

    // 显示错误消息
    this.errorMessage.classList.remove("hidden");

    // 添加错误动画效果
    this.errorMessage.style.transform = "translate(-50%, -50%) scale(0.9)";
    this.errorMessage.style.opacity = "0";

    setTimeout(() => {
      this.errorMessage.style.transform = "translate(-50%, -50%) scale(1)";
      this.errorMessage.style.opacity = "1";
    }, 100);

    console.log("显示错误信息:", userMessage);
  }

  /**
   * 获取用户友好的错误消息
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  getErrorMessage(error) {
    const errorMessages = {
      请求超时: "网络连接超时，请稍后重试",
      网络连接失败: "无法连接到服务器，请检查网络",
      "HTTP错误: 404": "图片服务暂时不可用",
      "HTTP错误: 500": "服务器内部错误，请稍后重试",
      API响应格式无效: "服务器返回数据格式错误",
      API返回的图片URL格式无效: "获取到的图片地址无效",
      图片资源加载失败: "图片加载失败，请重试",
    };

    for (const [key, message] of Object.entries(errorMessages)) {
      if (error.message.includes(key)) {
        return message;
      }
    }

    return "获取图片失败，请稍后重试";
  }

  /**
   * 隐藏错误信息
   */
  hideError() {
    this.errorMessage.classList.add("hidden");
  }

  /**
   * 显示用户操作反馈
   * @param {string} message - 反馈消息
   * @param {number} duration - 显示时长（毫秒）
   */
  showUserFeedback(message, duration = 1500) {
    // 清除之前的反馈定时器
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    // 创建反馈元素（如果不存在）
    let feedbackElement = document.getElementById("user-feedback");
    if (!feedbackElement) {
      feedbackElement = document.createElement("div");
      feedbackElement.id = "user-feedback";
      feedbackElement.className = "user-feedback";
      document.getElementById("app").appendChild(feedbackElement);
    }

    // 设置反馈消息
    feedbackElement.textContent = message;
    feedbackElement.classList.remove("hidden");

    // 添加显示动画
    feedbackElement.style.opacity = "0";
    feedbackElement.style.transform = "translateY(20px)";

    setTimeout(() => {
      feedbackElement.style.opacity = "1";
      feedbackElement.style.transform = "translateY(0)";
    }, 50);

    // 设置自动隐藏
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
   * @param {ResponsiveManager} responsiveManager - 响应式管理器实例
   * @returns {Promise<void>}
   */
  async displayImage(imageUrl, responsiveManager = null) {
    return new Promise((resolve, reject) => {
      // 清除现有图片
      this.clearImage();

      // 创建新的图片元素
      const img = document.createElement("img");
      let isResolved = false;

      // 图片加载超时设置（10秒）
      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.error("图片加载超时:", imageUrl);
          reject(new Error("图片加载超时，请重试"));
        }
      }, 10000);

      // 设置图片加载事件
      img.onload = () => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeout);

        console.log("图片资源加载成功:", imageUrl);

        // 如果提供了响应式管理器，自动调整图片尺寸
        if (responsiveManager) {
          responsiveManager.adjustImageSize(img);
        }

        // 添加图片显示动画
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

      // 设置图片属性
      img.src = imageUrl;
      img.alt = "H5 图片展示";
      img.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      // 添加到容器
      this.imageContainer.appendChild(img);
    });
  }

  /**
   * 清除当前显示的图片
   */
  clearImage() {
    const existingImg = this.imageContainer.querySelector("img");
    if (existingImg) {
      // 添加淡出动画
      existingImg.style.opacity = "0";
      setTimeout(() => {
        existingImg.remove();
      }, 200);
    }
  }

  /**
   * 检查当前是否处于错误状态
   * @returns {boolean} 是否处于错误状态
   */
  isErrorState() {
    return this.currentState === "error";
  }

  /**
   * 检查当前是否处于加载状态
   * @returns {boolean} 是否处于加载状态
   */
  isLoadingState() {
    return this.currentState === "loading";
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
    const img = this.imageContainer.querySelector("img");
    return img ? img.src : null;
  }

  /**
   * 销毁UI控制器，清理资源
   */
  destroy() {
    this.clearProgressTimer();

    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }

    // 移除用户反馈元素
    const feedbackElement = document.getElementById("user-feedback");
    if (feedbackElement) {
      feedbackElement.remove();
    }
  }
}

/**
 * 图片展示器主类 - 管理图片加载和显示
 */
class ImageViewer {
  constructor() {
    console.log("ImageViewer 初始化");
    this.apiService = new ApiService();
    this.uiController = new UIController();
    this.responsiveManager = new ResponsiveManager();

    // 初始化图片URL队列系统
    this.imageUrlQueue = [];
    this.maxQueueSize = 10; // 最大队列长度

    // 初始化历史记录系统
    this.imageHistory = []; // 历史记录栈
    this.currentHistoryIndex = -1; // 当前在历史中的位置，-1表示最新
    this.maxHistorySize = 30; // 最大历史记录数量
    this.currentImageUrl = null; // 当前显示的图片URL
    
    // 初始化状态标志
    this.isInitialLoad = true; // 标记是否为初始加载

    // 优化后的性能组件配置 - 集成浏览器缓存优化器
    this.browserCacheOptimizer = new BrowserCacheOptimizer({
      enableServiceWorker: true,
      cacheStrategy: "cache-first",
      maxAge: 3600, // 1小时
      maxPreloadLinks: 2, // 最多2个预加载链接
    });

    this.imageCache = new ImageCache({
      maxCacheSize: 3, // 进一步减少缓存数量
      maxMemorySize: 15 * 1024 * 1024, // 减少到15MB
    });
    this.performanceMonitor = new PerformanceMonitor();
    this.preloadStrategy = new EnhancedPreloadStrategy(
      this.apiService,
      this.imageCache,
      {
        preloadCount: 1, // 进一步减少预加载数量
        adaptiveThreshold: 0.9, // 进一步提高缓存命中率阈值
        maxPreloadCount: 2, // 进一步减少最大预加载数量
        minPreloadCount: 1, // 保持最小预加载数量
        preloadDelay: 4000, // 增加预加载延迟到4秒
        performanceMonitor: this.performanceMonitor,
        imageViewer: this, // 传递当前实例以访问队列方法
      }
    );
    this.eventOptimizer = new EventOptimizer();

    // 初始化用户引导管理器（带错误处理）
    try {
      this.userGuideManager = new UserGuideManager({
        storageKey: "h5-image-viewer-settings",
        language: "zh-CN",
        autoShow: true,
      });
    } catch (error) {
      console.error("用户引导管理器初始化失败:", error);
      this.userGuideManager = null;

      // 使用错误处理器记录错误
      if (window.GuideErrorHandlers?.guideErrorHandler) {
        window.GuideErrorHandlers.guideErrorHandler.logError(
          "UserGuideManager初始化",
          error
        );
      }
    }

    // 初始化动画控制器
    this.animationController = new AnimationController({
      duration: 300,
      easing: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      enableHardwareAcceleration: true,
      disableInteractionDuringAnimation: true,
    });

    // 初始化历史面板优化器
    this.historyPanelOptimizer = new HistoryPanelOptimizer(this.imageCache, {
      maxVisibleItems: 20, // 基于测试结果，可以适当增加显示数量
      imageTimeout: 1500, // 进一步减少超时时间到1.5秒
      batchSize: 5, // 增加批量大小，提高渲染效率
      lazyLoadThreshold: 3, // 减少懒加载阈值
    });

    // 设置动画性能监控
    this.setupAnimationPerformanceMonitoring();

    this.initializeTouchState();
    this.bindEvents();
    this.setupResponsiveHandlers();
    this.setupUserGuideHandlers();
    
    // 确保错误信息在初始化时是隐藏的
    this.uiController.hideError();
    
    // 延迟初始图片加载，确保所有服务都已准备好
    setTimeout(() => {
      this.loadFirstImage();
    }, 2000);

    // 优化启动预加载策略 - 延迟更长时间，减少初始负载
    setTimeout(() => {
      this.preloadStrategy.startPreloading();
    }, 5000); // 增加到5秒延迟

    // 初始化用户引导功能
    setTimeout(() => {
      this.initializeUserGuide();
    }, 1000);

    // 绑定帮助按钮事件
    this.bindHelpButton();
  }

  /**
   * 向图片URL队列添加URL
   * @param {string} imageUrl - 图片URL
   */
  addToQueue(imageUrl) {
    if (!imageUrl || this.imageUrlQueue.includes(imageUrl)) {
      return; // 避免重复添加
    }

    // 如果队列已满，移除最旧的URL
    if (this.imageUrlQueue.length >= this.maxQueueSize) {
      const removedUrl = this.imageUrlQueue.shift();
      console.log("队列已满，移除最旧的URL:", removedUrl);
    }

    this.imageUrlQueue.push(imageUrl);
    console.log(
      "添加URL到队列:",
      imageUrl,
      "队列长度:",
      this.imageUrlQueue.length
    );
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
    console.log(
      "从队列获取URL:",
      url,
      "剩余队列长度:",
      this.imageUrlQueue.length
    );
    return url;
  }

  /**
   * 获取队列状态
   * @returns {Object} 队列状态信息
   */
  getQueueStatus() {
    return {
      length: this.imageUrlQueue.length,
      maxSize: this.maxQueueSize,
      urls: [...this.imageUrlQueue], // 返回副本
    };
  }

  /**
   * 添加图片到历史记录
   * @param {string} imageUrl - 图片URL
   */
  addToHistory(imageUrl) {
    if (!imageUrl) return;

    // 如果当前不在历史记录的末尾，需要清除后面的记录
    if (this.currentHistoryIndex !== -1) {
      this.imageHistory = this.imageHistory.slice(0, this.currentHistoryIndex + 1);
      this.currentHistoryIndex = -1;
    }

    // 避免重复添加相同的URL
    if (this.imageHistory.length > 0 && this.imageHistory[this.imageHistory.length - 1] === imageUrl) {
      return;
    }

    // 添加到历史记录
    this.imageHistory.push(imageUrl);

    // 限制历史记录大小
    if (this.imageHistory.length > this.maxHistorySize) {
      this.imageHistory.shift(); // 移除最旧的记录
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

    // 如果当前在最新位置（-1），开始从倒数第二张开始
    if (this.currentHistoryIndex === -1) {
      if (this.imageHistory.length < 2) {
        return null; // 历史记录不足
      }
      this.currentHistoryIndex = this.imageHistory.length - 2;
    } else {
      // 继续向前移动
      this.currentHistoryIndex--;
      if (this.currentHistoryIndex < 0) {
        this.currentHistoryIndex = 0;
        return null; // 已经到达历史开头
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
   * 前进到历史记录中的下一张
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
   * 初始化触摸状态
   */
  initializeTouchState() {
    this.touchState = {
      startY: 0,
      currentY: 0,
      deltaY: 0,
      isScrolling: false,
      startTime: 0,
      minSwipeDistance: 50, // 最小滑动距离阈值
      maxSwipeTime: 1000, // 最大滑动时间（毫秒）
      minSwipeVelocity: 0.1, // 最小滑动速度（像素/毫秒）
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

    // 桌面端交互控制
    this.bindDesktopEvents();

    // 移动端触摸交互控制
    this.bindTouchEvents();
  }

  /**
   * 绑定桌面端交互事件
   */
  bindDesktopEvents() {
    // 获取浏览器兼容性实例
    const compatibility = window.browserCompatibility;

    // 使用优化的事件监听器
    const optimizedWheelHandler = this.eventOptimizer.throttle(
      (event) => {
        this.handleWheelEvent(event);
      },
      300,
      "wheel"
    );

    const optimizedKeyHandler = this.eventOptimizer.throttle(
      (event) => {
        this.handleKeyboardEvent(event);
      },
      300,
      "keyboard"
    );

    // 使用兼容的事件监听器
    compatibility.addEventListener(window, "wheel", optimizedWheelHandler, {
      passive: false,
    });
    compatibility.addEventListener(window, "keydown", optimizedKeyHandler, {
      passive: false,
    });

    console.log("桌面端交互事件已绑定（兼容版本）");
  }

  /**
   * 绑定移动端触摸交互事件
   */
  bindTouchEvents() {
    // 触摸开始事件
    this.uiController.imageContainer.addEventListener(
      "touchstart",
      (event) => {
        this.handleTouchStart(event);
      },
      { passive: false }
    );

    // 触摸移动事件
    this.uiController.imageContainer.addEventListener(
      "touchmove",
      (event) => {
        this.handleTouchMove(event);
      },
      { passive: false }
    );

    // 触摸结束事件
    this.uiController.imageContainer.addEventListener(
      "touchend",
      (event) => {
        this.handleTouchEnd(event);
      },
      { passive: false }
    );

    console.log("移动端触摸交互事件已绑定");
  }

  /**
   * 设置响应式处理器
   */
  setupResponsiveHandlers() {
    // 监听屏幕方向变化
    this.responsiveManager.onOrientationChange(
      (newOrientation, oldOrientation, deviceInfo) => {
        console.log(`屏幕方向变化: ${oldOrientation} -> ${newOrientation}`);
        this.uiController.showUserFeedback(
          `屏幕已${newOrientation === "portrait" ? "竖屏" : "横屏"}`,
          1000
        );

        // 重新调整当前图片尺寸
        this.adjustCurrentImageSize();
      }
    );

    // 监听设备类型变化
    this.responsiveManager.onDeviceChange(
      (newDeviceType, oldDeviceType, deviceInfo) => {
        console.log(`设备类型变化: ${oldDeviceType} -> ${newDeviceType}`);
        this.uiController.showUserFeedback(
          `切换到${this.getDeviceTypeName(newDeviceType)}模式`,
          1500
        );

        // 重新调整当前图片尺寸
        this.adjustCurrentImageSize();
      }
    );

    // 监听窗口尺寸变化
    this.responsiveManager.onResize((deviceInfo) => {
      console.log(
        "窗口尺寸变化:",
        deviceInfo.screenWidth,
        "x",
        deviceInfo.screenHeight
      );

      // 重新调整当前图片尺寸
      this.adjustCurrentImageSize();
    });

    console.log("响应式处理器已设置");
  }

  /**
   * 设置动画性能监控
   */
  setupAnimationPerformanceMonitoring() {
    // 监听动画开始事件
    this.animationController.onStart((animator) => {
      console.log("动画开始:", {
        direction: animator.direction,
        duration: animator.options.duration,
      });

      // 记录动画开始时间
      if (
        this.performanceMonitor &&
        typeof this.performanceMonitor.recordAnimationStart === "function"
      ) {
        this.performanceMonitor.recordAnimationStart();
      }
    });

    // 监听动画完成事件
    this.animationController.onComplete((animator, actualDuration) => {
      console.log("动画完成:", {
        direction: animator.direction,
        expectedDuration: animator.options.duration,
        actualDuration: actualDuration,
      });

      // 记录动画完成
      if (
        this.performanceMonitor &&
        typeof this.performanceMonitor.recordAnimationComplete === "function"
      ) {
        this.performanceMonitor.recordAnimationComplete(actualDuration);
      }

      // 检查动画性能
      if (actualDuration > animator.options.duration * 1.5) {
        console.warn("动画执行时间超出预期:", {
          expected: animator.options.duration,
          actual: actualDuration,
        });
      }
    });

    // 监听动画取消事件
    this.animationController.onCancel((animator, reason) => {
      console.warn("动画被取消:", {
        direction: animator.direction,
        reason: reason.message,
      });

      // 记录动画取消
      this.performanceMonitor.recordAnimationCancel(reason);
    });

    // 监听性能问题事件
    this.animationController.onPerformanceIssue((metrics) => {
      console.warn("动画性能问题:", metrics);

      // 记录性能问题
      this.performanceMonitor.recordPerformanceIssue("animation", metrics);

      // 使用错误处理器处理性能问题
      if (window.GuideErrorHandlers?.animationErrorHandler) {
        const suggestions =
          window.GuideErrorHandlers.animationErrorHandler.handlePerformanceIssue(
            metrics
          );
        this.applyAnimationOptimizations(suggestions);
      } else {
        // 根据性能问题调整动画设置
        this.optimizeAnimationSettings(metrics);
      }
    });

    console.log("动画性能监控已设置");
  }

  /**
   * 应用动画优化建议
   * @param {Object} suggestions - 优化建议
   */
  applyAnimationOptimizations(suggestions) {
    const currentOptions = this.animationController.options;
    let newOptions = { ...currentOptions };
    let hasChanges = false;

    if (suggestions.disableHardwareAcceleration) {
      newOptions.enableHardwareAcceleration = false;
      hasChanges = true;
      console.log("已禁用硬件加速");
    }

    if (suggestions.increaseDuration) {
      newOptions.duration = Math.min(currentOptions.duration * 1.3, 600);
      hasChanges = true;
      console.log("已增加动画持续时间");
    }

    if (suggestions.simplifyEasing) {
      newOptions.easing = "ease";
      hasChanges = true;
      console.log("已简化缓动函数");
    }

    if (suggestions.disableAnimation) {
      // 启用降级模式，禁用所有动画
      this.animationFallbackMode = true;
      hasChanges = true;
      console.log("已启用动画降级模式");
    }

    if (hasChanges) {
      this.animationController.setOptions(newOptions);
      console.log("动画设置已根据建议优化:", newOptions);
    }
  }

  /**
   * 根据性能指标优化动画设置
   * @param {Object} metrics - 性能指标
   */
  optimizeAnimationSettings(metrics) {
    const currentOptions = this.animationController.options;

    // 如果丢帧严重，降低动画质量
    if (metrics.droppedFrames > 10) {
      console.log("检测到严重丢帧，优化动画设置");

      // 增加动画持续时间以减少性能压力
      const newDuration = Math.min(currentOptions.duration * 1.2, 500);

      // 禁用硬件加速（在某些设备上可能有帮助）
      const newOptions = {
        ...currentOptions,
        duration: newDuration,
        enableHardwareAcceleration: false,
      };

      this.animationController.setOptions(newOptions);

      console.log("动画设置已优化:", newOptions);
    }

    // 如果动画持续时间过长，简化动画
    if (metrics.duration > currentOptions.duration * 2) {
      console.log("检测到动画执行缓慢，简化动画效果");

      const newOptions = {
        ...currentOptions,
        duration: Math.max(currentOptions.duration * 0.8, 200),
        easing: "ease", // 使用更简单的缓动函数
      };

      this.animationController.setOptions(newOptions);

      console.log("动画设置已简化:", newOptions);
    }
  }

  /**
   * 设置用户引导处理器
   */
  setupUserGuideHandlers() {
    // 监听引导显示事件
    this.userGuideManager.onShow((content) => {
      console.log("用户引导已显示:", content.deviceType);

      // 引导显示时暂停图片切换功能
      this.pauseImageSwitching();
    });

    // 监听引导隐藏事件
    this.userGuideManager.onHide(() => {
      console.log("用户引导已隐藏");

      // 引导隐藏时恢复图片切换功能
      this.resumeImageSwitching();
    });

    // 监听引导内容更新事件
    this.userGuideManager.onContentUpdate((content) => {
      console.log("引导内容已更新:", content.deviceType);
    });

    // 监听引导错误事件
    this.userGuideManager.onError((message, error) => {
      console.error("用户引导错误:", message, error);

      // 显示用户友好的错误提示
      this.uiController.showUserFeedback("引导功能暂时不可用", 2000);
    });

    console.log("用户引导处理器已设置");
  }

  /**
   * 初始化用户引导功能
   */
  initializeUserGuide() {
    try {
      // 初始化引导管理器
      const success = this.userGuideManager.initialize();

      if (success) {
        console.log("用户引导功能初始化成功");
      } else {
        console.log("用户引导功能初始化完成，但未显示引导");
      }

      // 添加键盘快捷键支持（F1键显示帮助）
      this.addHelpKeyboardShortcut();
    } catch (error) {
      console.error("用户引导功能初始化失败:", error);
    }
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
   * 创建历史项目元素（优化版本）
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

    // 创建图片元素 - 使用优化的加载策略
    const img = document.createElement('img');
    img.alt = `历史图片 ${index + 1}`;
    img.loading = 'lazy';
    img.decoding = 'async'; // 异步解码，避免阻塞主线程
    
    // 设置占位符，避免布局跳动
    img.style.backgroundColor = '#f0f0f0';
    img.style.minHeight = '80px';
    img.style.width = '100%';
    img.style.objectFit = 'cover';

    // 优化的图片加载 - 先检查缓存
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
    const cachedImage = this.imageCache.get(imageUrl);
    
    if (cachedImage) {
      // 使用缓存的图片
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
    // 设置加载超时（减少到3秒）
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
      
      // 异步缓存图片，不阻塞UI
      setTimeout(() => {
        this.imageCache.set(imageUrl, img).catch(error => {
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

    // 设置图片源，开始加载
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
    this.displayImage(targetUrl);
    
    // 更新历史面板
    this.updateHistoryPanel();
    
    // 显示反馈
    this.uiController.showUserFeedback(`已跳转到第 ${index + 1} 张图片`, 1500);
  }

  /**
   * 绑定帮助按钮事件
   */
  bindHelpButton() {
    const helpButton = document.getElementById("help-button");

    if (!helpButton) {
      console.error("帮助按钮元素未找到，ID: help-button");
      return;
    }

    console.log("找到帮助按钮元素:", helpButton);

    // 检测是否为触摸设备（使用更可靠的检测方法）
    const isTouchDevice =
      "ontouchstart" in window ||
      navigator.maxTouchPoints > 0 ||
      navigator.msMaxTouchPoints > 0;
    console.log(`设备类型检测: ${isTouchDevice ? "触摸设备" : "非触摸设备"}`);

    // 为所有设备绑定触摸事件（作为主要交互方式）
    let touchHandled = false;

    // 触摸开始事件
    helpButton.addEventListener(
      "touchstart",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log("帮助按钮触摸开始");
        touchHandled = true;

        // 添加触摸反馈
        helpButton.style.transform = "scale(0.95)";
        helpButton.style.background = "rgba(255, 255, 255, 0.25)";
        helpButton.style.transition = "all 0.1s ease";
      },
      { passive: false }
    );

    // 触摸结束事件
    helpButton.addEventListener(
      "touchend",
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        console.log("帮助按钮触摸结束，触发点击处理");

        // 恢复按钮状态
        helpButton.style.transform = "scale(1)";
        helpButton.style.background = "";

        // 延迟触发点击处理，确保视觉反馈完成
        setTimeout(() => {
          this.handleHelpButtonClick();
        }, 50);
      },
      { passive: false }
    );

    // 触摸取消时恢复状态
    helpButton.addEventListener(
      "touchcancel",
      (event) => {
        console.log("帮助按钮触摸取消");
        helpButton.style.transform = "scale(1)";
        helpButton.style.background = "";
        touchHandled = false;
      },
      { passive: false }
    );

    // 通用点击事件（作为备用，防止触摸事件失效）
    helpButton.addEventListener("click", (event) => {
      // 如果触摸事件已经处理，则跳过点击事件（防止重复触发）
      if (touchHandled) {
        touchHandled = false;
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      console.log("帮助按钮点击事件触发");
      this.handleHelpButtonClick();
    });

    // 键盘事件支持（Enter 和 Space）
    helpButton.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        console.log("帮助按钮键盘事件触发:", event.key);
        this.handleHelpButtonClick();
      }
    });

    // 添加鼠标事件用于桌面端反馈
    helpButton.addEventListener("mousedown", (event) => {
      if (
        !this.responsiveManager ||
        !this.responsiveManager.supportsTouchEvents()
      ) {
        helpButton.style.transform = "scale(0.95)";
      }
    });

    helpButton.addEventListener("mouseup", (event) => {
      if (
        !this.responsiveManager ||
        !this.responsiveManager.supportsTouchEvents()
      ) {
        helpButton.style.transform = "scale(1)";
      }
    });

    console.log("帮助按钮事件已绑定完成");
  }

  /**
   * 处理帮助按钮点击
   */
  handleHelpButtonClick() {
    try {
      console.log("帮助按钮被点击");

      // 显示用户反馈
      this.uiController.showUserFeedback("正在显示操作指南...", 1000);

      // 手动显示用户引导，不影响自动显示状态
      if (this.userGuideManager) {
        this.userGuideManager.showGuide(true); // forceShow = true
      } else {
        console.warn("UserGuideManager 未初始化");
        this.uiController.showUserFeedback("引导功能暂时不可用", 2000);
      }
    } catch (error) {
      console.error("显示帮助时发生错误:", error);
      this.uiController.showUserFeedback("显示帮助失败，请稍后重试", 2000);
    }
  }

  /**
   * 添加键盘快捷键支持（F1键显示帮助）
   */
  addHelpKeyboardShortcut() {
    // 使用优化的事件监听器
    const optimizedHelpKeyHandler = this.eventOptimizer.throttle(
      (event) => {
        // F1键显示帮助
        if (event.key === "F1") {
          event.preventDefault();
          this.handleHelpButtonClick();
        }
      },
      500,
      "help-shortcut"
    );

    // 绑定全局键盘事件
    document.addEventListener("keydown", optimizedHelpKeyHandler);

    console.log("帮助快捷键已绑定 (F1)");
  }

  /**
   * 暂停图片切换功能
   */
  pauseImageSwitching() {
    this.imageSwitchingPaused = true;
    console.log("图片切换功能已暂停");
  }

  /**
   * 恢复图片切换功能
   */
  resumeImageSwitching() {
    this.imageSwitchingPaused = false;
    console.log("图片切换功能已恢复");
  }

  /**
   * 添加帮助键盘快捷键
   */
  addHelpKeyboardShortcut() {
    document.addEventListener("keydown", (event) => {
      // F1键显示帮助
      if (event.key === "F1") {
        event.preventDefault();
        this.showUserGuide();
      }

      // Ctrl+Shift+H 或 Cmd+Shift+H 切换历史面板
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "H") {
        event.preventDefault();
        if (this.state.modules.imageViewer) {
          this.state.modules.imageViewer.toggleHistoryPanel();
        }
        return;
      }

      // Ctrl+Alt+H 或 Cmd+Alt+H 显示帮助（避免与历史功能快捷键冲突）
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === "H") {
        event.preventDefault();
        this.showUserGuide();
      }
    });

    console.log("帮助快捷键已添加 (F1 或 Ctrl+Alt+H)");
    console.log("历史面板快捷键已添加 (Ctrl+Shift+H)");
  }

  /**
   * 手动显示用户引导
   * @returns {boolean} 显示是否成功
   */
  showUserGuide() {
    try {
      const success = this.userGuideManager.showGuide(true); // 强制显示

      if (success) {
        console.log("手动显示用户引导成功");
        this.uiController.showUserFeedback("已显示操作指南", 1000);
      } else {
        console.log("手动显示用户引导失败");
        this.uiController.showUserFeedback("无法显示操作指南", 1500);
      }

      return success;
    } catch (error) {
      console.error("手动显示用户引导失败:", error);
      this.uiController.showUserFeedback("引导功能暂时不可用", 2000);
      return false;
    }
  }

  /**
   * 检查图片切换是否被暂停
   * @returns {boolean} 是否被暂停
   */
  isImageSwitchingPaused() {
    return this.imageSwitchingPaused || false;
  }

  /**
   * 获取设备类型的中文名称
   * @param {string} deviceType - 设备类型
   * @returns {string} 中文名称
   */
  getDeviceTypeName(deviceType) {
    const names = {
      mobile: "移动端",
      tablet: "平板",
      desktop: "桌面端",
    };
    return names[deviceType] || deviceType;
  }

  /**
   * 调整当前图片尺寸
   */
  adjustCurrentImageSize() {
    const currentImg = this.uiController.imageContainer.querySelector("img");
    if (currentImg && currentImg.complete) {
      // 延迟执行以确保DOM更新完成
      setTimeout(() => {
        this.responsiveManager.adjustImageSize(currentImg);
      }, 100);
    }
  }

  /**
   * 处理触摸开始事件
   * @param {TouchEvent} event - 触摸事件对象
   */
  handleTouchStart(event) {
    // 检查是否正在加载中，如果是则忽略操作
    if (this.uiController.isLoadingState()) {
      console.log("图片加载中，忽略触摸操作");
      return;
    }

    // 检查图片切换是否被暂停
    if (this.isImageSwitchingPaused()) {
      console.log("图片切换功能已暂停，忽略触摸操作");
      return;
    }

    // 只处理单指触摸
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];

    // 重置触摸状态
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
    // 检查是否正在滚动状态
    if (!this.touchState.isScrolling) {
      return;
    }

    // 检查是否正在加载中，如果是则忽略操作
    if (this.uiController.isLoadingState()) {
      return;
    }

    // 只处理单指触摸
    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    this.touchState.currentY = touch.clientY;
    this.touchState.deltaY = this.touchState.currentY - this.touchState.startY;

    // 阻止默认的滚动行为
    event.preventDefault();

    console.log("触摸移动:", {
      currentY: this.touchState.currentY,
      deltaY: this.touchState.deltaY,
    });
  }

  /**
   * 处理触摸结束事件
   * @param {TouchEvent} event - 触摸事件对象
   */
  handleTouchEnd(event) {
    // 检查是否正在滚动状态
    if (!this.touchState.isScrolling) {
      return;
    }

    // 检查是否正在加载中，如果是则忽略操作
    if (this.uiController.isLoadingState()) {
      console.log("图片加载中，忽略触摸操作");
      this.touchState.isScrolling = false;
      return;
    }

    const endTime = Date.now();
    const swipeTime = endTime - this.touchState.startTime;
    const swipeDistance = Math.abs(this.touchState.deltaY);
    const swipeVelocity = swipeDistance / swipeTime; // 像素/毫秒

    console.log("触摸结束:", {
      deltaY: this.touchState.deltaY,
      swipeTime,
      swipeDistance,
      swipeVelocity,
      minDistance: this.touchState.minSwipeDistance,
      maxTime: this.touchState.maxSwipeTime,
      minVelocity: this.touchState.minSwipeVelocity,
    });

    // 判断是否满足滑动条件
    const isValidSwipe = this.isValidSwipe(
      swipeDistance,
      swipeTime,
      swipeVelocity
    );

    if (isValidSwipe) {
      this.handleSwipeGesture(this.touchState.deltaY);
    } else {
      console.log("滑动不满足阈值条件，忽略操作");
    }

    // 重置触摸状态
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
    // 检查滑动距离是否达到最小阈值
    const hasMinDistance = distance >= this.touchState.minSwipeDistance;

    // 检查滑动时间是否在合理范围内
    const isWithinTimeLimit = time <= this.touchState.maxSwipeTime;

    // 检查滑动速度是否达到最小要求
    const hasMinVelocity = velocity >= this.touchState.minSwipeVelocity;

    console.log("滑动验证:", {
      hasMinDistance,
      isWithinTimeLimit,
      hasMinVelocity,
      isValid: hasMinDistance && isWithinTimeLimit && hasMinVelocity,
    });

    return hasMinDistance && isWithinTimeLimit && hasMinVelocity;
  }

  /**
   * 处理滑动手势
   * @param {number} deltaY - Y轴偏移量
   */
  handleSwipeGesture(deltaY) {
    console.log("处理滑动手势:", deltaY);

    if (deltaY > 0) {
      // 向下滑动 - 切换到上一张图片
      console.log("向下滑动，切换到上一张图片");
      this.switchToPreviousImage();
    } else if (deltaY < 0) {
      // 向上滑动 - 切换到下一张图片
      console.log("向上滑动，切换到下一张图片");
      this.switchToNextImage();
    }
  }

  /**
   * 处理鼠标滚轮事件
   * @param {WheelEvent} event - 滚轮事件对象
   */
  handleWheelEvent(event) {
    // 阻止默认滚动行为
    event.preventDefault();

    // 检查是否正在加载中，如果是则忽略操作
    if (this.uiController.isLoadingState()) {
      console.log("图片加载中，忽略滚轮操作");
      return;
    }

    // 检查图片切换是否被暂停
    if (this.isImageSwitchingPaused()) {
      console.log("图片切换功能已暂停，忽略滚轮操作");
      return;
    }

    console.log("滚轮事件:", event.deltaY);

    if (event.deltaY > 0) {
      // 向下滚动 - 切换到下一张图片
      console.log("向下滚动，切换到下一张图片");
      this.switchToNextImage();
    } else if (event.deltaY < 0) {
      // 向上滚动 - 切换到上一张图片
      console.log("向上滚动，切换到上一张图片");
      this.switchToPreviousImage();
    }
  }

  /**
   * 处理键盘事件
   * @param {KeyboardEvent} event - 键盘事件对象
   */
  handleKeyboardEvent(event) {
    // 检查是否正在加载中，如果是则忽略操作
    if (this.uiController.isLoadingState()) {
      console.log("图片加载中，忽略键盘操作");
      return;
    }

    // 检查图片切换是否被暂停
    if (this.isImageSwitchingPaused()) {
      console.log("图片切换功能已暂停，忽略键盘操作");
      return;
    }

    console.log("键盘事件:", event.key);

    switch (event.key) {
      case "ArrowDown":
        // 向下箭头键 - 切换到下一张图片
        event.preventDefault();
        console.log("按下向下箭头键，切换到下一张图片");
        this.switchToNextImage();
        break;
      case "ArrowUp":
        // 向上箭头键 - 切换到上一张图片
        event.preventDefault();
        console.log("按下向上箭头键，切换到上一张图片");
        this.switchToPreviousImage();
        break;
      case "ArrowLeft":
        // 向左箭头键 - 切换到上一张图片
        event.preventDefault();
        console.log("按下向左箭头键，切换到上一张图片");
        this.switchToPreviousImage();
        break;
      case "ArrowRight":
        // 向右箭头键 - 切换到下一张图片
        event.preventDefault();
        console.log("按下向右箭头键，切换到下一张图片");
        this.switchToNextImage();
        break;
      case "h":
      case "H":
        // H键 - 历史功能
        if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
          // Ctrl+Shift+H - 切换历史面板
          event.preventDefault();
          console.log("按下Ctrl+Shift+H，切换历史面板");
          this.toggleHistoryPanel();
        } else if (event.ctrlKey || event.metaKey) {
          // Ctrl+H - 显示历史状态
          event.preventDefault();
          console.log("按下Ctrl+H，显示历史状态");
          this.showHistoryStatus();
        }
        break;
      default:
        // 其他键不处理
        break;
    }
  }

  /**
   * 切换到下一张图片
   */
  async switchToNextImage() {
    console.log("切换到下一张图片");

    // 检查是否正在动画中
    if (this.animationController.isAnimationInProgress()) {
      console.log("动画进行中，忽略切换请求");
      return;
    }

    this.uiController.showSwitchFeedback("next");

    try {
      // 先检查是否可以从历史记录前进
      const nextFromHistory = this.getNextFromHistory();
      if (nextFromHistory) {
        console.log("从历史记录前进到下一张:", nextFromHistory);
        await this.displayHistoryImage(nextFromHistory, "up");
        return;
      }

      // 如果没有历史记录可前进，将当前图片加入历史并获取新图片
      if (this.currentImageUrl) {
        this.addToHistory(this.currentImageUrl);
      }

      await this.loadImageWithAnimation("up"); // 向上滑动表示下一张
    } catch (error) {
      console.error("切换到下一张图片失败:", error);
      // 如果动画失败，回退到普通加载
      this.loadImage();
    }
  }

  /**
   * 切换到上一张图片
   */
  async switchToPreviousImage() {
    console.log("切换到上一张图片");

    // 检查是否正在动画中
    if (this.animationController.isAnimationInProgress()) {
      console.log("动画进行中，忽略切换请求");
      return;
    }

    this.uiController.showSwitchFeedback("previous");

    try {
      // 从历史记录获取上一张图片
      const previousUrl = this.getPreviousFromHistory();
      if (previousUrl) {
        console.log("从历史记录获取上一张:", previousUrl);
        await this.displayHistoryImage(previousUrl, "down");
        return;
      }

      // 如果没有历史记录，提示用户
      console.log("已经是第一张图片，没有更多历史记录");
      this.uiController.showUserFeedback("已经是第一张图片", 1000);
    } catch (error) {
      console.error("切换到上一张图片失败:", error);
      this.uiController.showUserFeedback("切换失败，请重试", 1000);
    }
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
      const currentImg = this.uiController.imageContainer.querySelector("img");

      // 检查缓存
      let cachedImage = this.imageCache.get(imageUrl);
      let newImg;

      if (cachedImage) {
        console.log("使用缓存的历史图片:", imageUrl);
        this.performanceMonitor.recordCacheHit(true);

        // 克隆缓存的图片
        newImg = cachedImage.cloneNode();

        // 调整图片尺寸
        if (this.responsiveManager) {
          this.responsiveManager.adjustImageSize(newImg);
        }
      } else {
        console.log("历史图片缓存未命中，重新加载:", imageUrl);
        this.performanceMonitor.recordCacheHit(false);

        // 预加载历史图片
        newImg = await this.preloadImageForAnimation(imageUrl);

        // 缓存历史图片
        try {
          await this.imageCache.set(imageUrl, newImg);
        } catch (cacheError) {
          console.warn("历史图片缓存失败:", cacheError);
        }
      }

      // 执行动画切换
      await this.executeImageSwitchAnimation(currentImg, newImg, direction);

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
   * 防抖函数 - 防止频繁触发事件
   * @param {Function} func - 要防抖的函数
   * @param {number} delay - 延迟时间（毫秒）
   * @returns {Function} 防抖后的函数
   */
  debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      // 清除之前的定时器
      clearTimeout(timeoutId);

      // 设置新的定时器
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  }

  /**
   * 带动画的图片加载
   * @param {string} direction - 动画方向 ('up' 表示下一张, 'down' 表示上一张)
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
      const currentImg = this.uiController.imageContainer.querySelector("img");

      // 显示加载状态（但不清除当前图片）
      this.uiController.showLoading();

      // 获取新图片URL
      const apiStartTime = performance.now();
      const imageUrl = await this.apiService.fetchImage();
      const apiEndTime = performance.now();

      // 记录API调用时间
      this.performanceMonitor.recordApiCallTime(apiStartTime, apiEndTime, true);

      // 检查缓存
      let cachedImage = this.imageCache.get(imageUrl);
      let newImg;

      if (cachedImage) {
        console.log("使用缓存图片进行动画切换:", imageUrl);
        this.performanceMonitor.recordCacheHit(true);

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
        this.performanceMonitor.recordCacheHit(false);

        // 预加载新图片
        newImg = await this.preloadImageForAnimation(imageUrl);

        // 缓存新图片
        try {
          await this.imageCache.set(imageUrl, newImg);
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
      this.performanceMonitor.recordMemoryUsage(
        this.imageCache.getStats().memoryUsage
      );

      // 触发智能预加载
      this.preloadStrategy.smartPreload(imageUrl);

      // 触发图片加载完成后的自动预加载
      await this.preloadStrategy.preloadOnImageLoad(imageUrl);

      // 更新当前图片URL
      this.currentImageUrl = imageUrl;

      const endTime = performance.now();
      console.log(
        `带动画的图片加载完成，总耗时: ${(endTime - startTime).toFixed(2)}ms`
      );
    } catch (error) {
      const endTime = performance.now();
      console.error("带动画的图片加载失败:", error);

      // 记录错误和失败的API调用
      this.performanceMonitor.recordError(error, "loadImageWithAnimation");
      this.performanceMonitor.recordApiCallTime(startTime, endTime, false);

      // 如果动画加载失败，回退到普通加载
      console.log("回退到普通图片加载");
      this.loadImage();
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
        this.uiController.imageContainer.appendChild(newImg);

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

      // 添加新图片到容器（但不显示）
      this.uiController.imageContainer.appendChild(newImg);

      // 执行滑动动画
      await this.animationController.slideAnimation(
        currentImg,
        newImg,
        direction
      );

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
      if (newImg && !newImg.parentNode) {
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
   * 首次图片加载方法 - 带有更好的错误处理
   */
  async loadFirstImage() {
    try {
      console.log("开始首次图片加载...");
      
      // 强制确保UI处于正确的初始状态
      this.uiController.hideError();
      this.uiController.hideLoading();
      
      // 检查API服务是否可用
      if (!this.apiService) {
        console.error("API服务未初始化");
        this.uiController.showUserFeedback("正在初始化服务...", 2000);
        return;
      }
      
      // 显示友好的加载提示
      this.uiController.showUserFeedback("正在准备图片浏览器...", 1500);
      
      // 稍微延迟后调用正常的图片加载方法
      setTimeout(async () => {
        try {
          // 在加载前再次确保错误信息是隐藏的
          this.uiController.hideError();
          await this.loadImage();
        } catch (loadError) {
          console.error("延迟加载失败:", loadError);
          // 确保错误界面不会显示
          this.uiController.hideError();
          // 显示友好提示
          this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
        }
      }, 800);
      
    } catch (error) {
      console.error("首次图片加载失败:", error);
      
      // 确保错误界面不会显示
      this.uiController.hideError();
      // 显示友好的错误信息
      this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
    }
  }

  /**
   * 优化的图片加载方法 - 集成浏览器缓存优化器
   */
  async loadImage() {
    const startTime = performance.now();

    try {
      this.uiController.showLoading();
      console.log("开始优化图片加载...");

      // 检查网络连接
      if (!this.apiService.isOnline()) {
        throw new Error("网络连接不可用，请检查网络设置");
      }

      let imageUrl;
      let fromQueue = false;

      // 优先从队列中获取预加载的图片URL
      imageUrl = this.getNextFromQueue();
      if (imageUrl) {
        fromQueue = true;
        console.log("从预加载队列获取图片URL:", imageUrl);
      } else {
        // 队列为空时才调用API获取新图片
        const apiStartTime = performance.now();
        imageUrl = await this.apiService.fetchImage();
        const apiEndTime = performance.now();

        // 记录API调用时间
        this.performanceMonitor.recordApiCallTime(
          apiStartTime,
          apiEndTime,
          true
        );
        console.log("从API获取新图片URL:", imageUrl);
      }

      // 优先检查浏览器缓存
      const isBrowserCached = await this.browserCacheOptimizer.isImageCached(
        imageUrl
      );
      if (isBrowserCached) {
        console.log("使用浏览器缓存图片:", imageUrl);
        this.performanceMonitor.recordCacheHit(true);

        // 使用优化的图片加载
        const img = await this.browserCacheOptimizer.optimizedImageLoad(
          imageUrl
        );
        await this.uiController.displayImage(imageUrl, this.responsiveManager);
      } else {
        // 检查内存缓存（作为后备）
        let cachedImage = this.imageCache.get(imageUrl);

        if (cachedImage) {
          console.log("使用内存缓存图片:", imageUrl);
          this.performanceMonitor.recordCacheHit(true);

          // 显示缓存的图片
          await this.displayCachedImage(cachedImage, imageUrl);
        } else {
          console.log("缓存未命中，使用浏览器缓存优化器加载:", imageUrl);
          this.performanceMonitor.recordCacheHit(false);

          // 使用浏览器缓存优化器预加载并显示
          await this.browserCacheOptimizer.preloadImage(imageUrl);
          await this.uiController.displayImage(
            imageUrl,
            this.responsiveManager
          );
        }
      }

      // 减少内存使用情况记录频率
      if (Math.random() < 0.3) {
        // 只有30%的概率记录
        this.performanceMonitor.recordMemoryUsage(
          this.imageCache.getStats().memoryUsage
        );
      }

      // 减少预加载频率 - 只在队列较空时触发
      if (this.imageUrlQueue.length < 2) {
        // 触发智能预加载（补充队列）
        if (Math.random() < 0.6) {
          // 60%概率触发智能预加载
          this.preloadStrategy.smartPreload(imageUrl);
        }

        // 如果是从队列获取的图片，触发预加载补充
        if (fromQueue && Math.random() < 0.4) {
          // 40%概率触发预加载补充
          this.preloadStrategy.preloadOnImageLoad(imageUrl);
        }
      }

      // 更新当前图片URL
      this.currentImageUrl = imageUrl;
      
      // 标记初始加载已完成
      if (this.isInitialLoad) {
        this.isInitialLoad = false;
        console.log("初始图片加载成功");
      }

      // 更新历史面板（如果已打开）
      const historyPanel = document.getElementById('history-panel');
      if (historyPanel && historyPanel.classList.contains('open')) {
        this.updateHistoryPanel();
      }

      const endTime = performance.now();
      console.log(
        `优化图片加载完成，总耗时: ${(endTime - startTime).toFixed(
          2
        )}ms，来源: ${fromQueue ? "预加载队列" : "API调用"}`
      );
    } catch (error) {
      const endTime = performance.now();
      console.error("图片加载失败:", error);

      // 记录错误和失败的API调用
      this.performanceMonitor.recordError(error, "loadImage");
      this.performanceMonitor.recordApiCallTime(startTime, endTime, false);

      // 如果是初始加载，不显示错误界面，而是显示友好提示
      if (this.isInitialLoad) {
        console.log("初始加载失败，显示友好提示而不是错误界面");
        this.uiController.showUserFeedback("点击屏幕或按方向键开始浏览图片", 4000);
        this.isInitialLoad = false; // 标记初始加载已完成
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
      // 清除现有图片
      this.uiController.clearImage();

      // 克隆缓存的图片元素
      const img = cachedImage.cloneNode();

      // 如果提供了响应式管理器，自动调整图片尺寸
      if (this.responsiveManager) {
        this.responsiveManager.adjustImageSize(img);
      }

      // 添加图片显示动画
      img.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      img.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      // 添加到容器
      this.uiController.imageContainer.appendChild(img);

      setTimeout(() => {
        img.style.opacity = "1";
        img.style.transform = "scale(1)";
      }, 50);

      this.uiController.hideLoading();
      this.uiController.hideError();

      console.log("缓存图片显示完成:", imageUrl);
      resolve();
    });
  }

  /**
   * 加载新图片并缓存
   * @param {string} imageUrl - 图片URL
   */
  async loadAndCacheImage(imageUrl) {
    return new Promise((resolve, reject) => {
      // 创建新的图片元素
      const img = document.createElement("img");

      // 设置图片加载事件
      img.onload = async () => {
        console.log("图片资源加载成功:", imageUrl);

        try {
          // 缓存图片
          await this.imageCache.set(imageUrl, img);

          // 显示图片
          await this.uiController.displayImage(
            imageUrl,
            this.responsiveManager
          );

          // 触发图片加载完成后的自动预加载
          await this.preloadStrategy.preloadOnImageLoad(imageUrl);

          resolve();
        } catch (cacheError) {
          console.warn("图片缓存失败:", cacheError);
          // 即使缓存失败，仍然显示图片
          await this.uiController.displayImage(
            imageUrl,
            this.responsiveManager
          );

          // 即使缓存失败也要触发预加载
          try {
            await this.preloadStrategy.preloadOnImageLoad(imageUrl);
          } catch (preloadError) {
            console.warn("预加载触发失败:", preloadError);
          }

          resolve();
        }
      };

      img.onerror = () => {
        console.error("图片资源加载失败:", imageUrl);
        reject(new Error("图片资源加载失败，可能图片已损坏或不存在"));
      };

      // 设置图片属性
      img.src = imageUrl;
      img.alt = "H5 图片展示";
    });
  }

  /**
   * 获取性能报告
   * @returns {Object} 性能统计报告
   */
  getPerformanceReport() {
    return this.performanceMonitor.getPerformanceReport();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return this.imageCache.getStats();
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.imageCache.clear();
    console.log("图片缓存已清理");
  }

  /**
   * 输出性能报告到控制台
   */
  logPerformanceReport() {
    this.performanceMonitor.logPerformanceReport();

    const cacheStats = this.getCacheStats();
    console.group("📦 缓存统计");
    console.log(
      "缓存数量:",
      cacheStats.cacheSize + "/" + cacheStats.maxCacheSize
    );
    console.log("内存使用:", cacheStats.memoryUsagePercent + "%");
    console.log(
      "内存占用:",
      (cacheStats.memoryUsage / 1024 / 1024).toFixed(2) + "MB"
    );
    console.groupEnd();
  }
  /**
   * 显示缓存的图片
   * @param {HTMLImageElement} cachedImage - 缓存的图片元素
   * @param {string} imageUrl - 图片URL
   */
  async displayCachedImage(cachedImage, imageUrl) {
    return new Promise((resolve) => {
      // 清除现有图片
      this.uiController.clearImage();

      // 克隆缓存的图片元素
      const img = cachedImage.cloneNode();

      if (this.responsiveManager) {
        this.responsiveManager.adjustImageSize(img);
      }

      // 添加图片显示动画
      img.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      img.style.transition = "opacity 0.3s ease, transform 0.3s ease";

      // 添加到容器
      this.uiController.imageContainer.appendChild(img);

      setTimeout(() => {
        img.style.opacity = "1";
        img.style.transform = "scale(1)";
      }, 50);

      this.uiController.hideLoading();
      this.uiController.hideError();
      console.log("缓存图片显示完成:", imageUrl);
      resolve();
    });
  }

  /**
   * 加载新图片并缓存
   * @param {string} imageUrl - 图片URL
   */
  async loadAndCacheImage(imageUrl) {
    return new Promise((resolve, reject) => {
      // 创建新的图片元素
      const img = document.createElement("img");

      // 设置图片加载事件
      img.onload = async () => {
        console.log("图片资源加载成功:", imageUrl);

        try {
          // 缓存图片
          await this.imageCache.set(imageUrl, img);

          // 显示图片
          await this.uiController.displayImage(
            imageUrl,
            this.responsiveManager
          );

          resolve();
        } catch (cacheError) {
          console.warn("图片缓存失败:", cacheError);
          // 即使缓存失败，仍然显示图片
          await this.uiController.displayImage(
            imageUrl,
            this.responsiveManager
          );
          resolve();
        }
      };

      img.onerror = () => {
        console.error("图片资源加载失败:", imageUrl);
        reject(new Error("图片资源加载失败，可能图片已损坏或不存在"));
      };

      // 设置图片属性
      img.src = imageUrl;
      img.alt = "H5 图片展示";
    });
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
    return this.performanceMonitor.getPerformanceReport();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return this.imageCache.getStats();
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.imageCache.clear();
    console.log("图片缓存已清理");
  }

  /**
   * 输出性能报告到控制台
   */
  logPerformanceReport() {
    this.performanceMonitor.logPerformanceReport();

    const cacheStats = this.getCacheStats();
    console.group("📦 缓存统计");
    console.log(
      "缓存数量:",
      cacheStats.cacheSize + "/" + cacheStats.maxCacheSize
    );
    console.log("内存使用:", cacheStats.memoryUsagePercent + "%");
    console.log(
      "内存占用:",
      (cacheStats.memoryUsage / 1024 / 1024).toFixed(2) + "MB"
    );
    console.groupEnd();
  }

  /**
   * 销毁图片查看器，清理资源
   */
  destroy() {
    // 清理性能优化组件
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

    // 清理用户引导管理器
    if (this.userGuideManager) {
      this.userGuideManager.destroy();
    }

    // 清理动画控制器
    if (this.animationController) {
      this.animationController.destroy();
    }

    // 清理其他组件
    if (this.uiController) {
      this.uiController.destroy();
    }

    if (this.responsiveManager) {
      this.responsiveManager.destroy();
    }

    console.log("ImageViewer 已销毁");
  }
}

/**
 * 主应用类 - 整合所有功能模块并管理应用生命周期
 */
class H5ImageViewerApp {
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
      maxErrorCount: 5,
      errorResetTime: 60000, // 1分钟后重置错误计数
      retryDelay: 2000,
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
      event.preventDefault(); // 阻止默认的错误处理
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

    // 如果错误次数过多，启用降级模式
    if (this.state.errorCount >= this.config.maxErrorCount) {
      this.enableFallbackMode();
      return;
    }

    // 尝试恢复应用
    this.attemptRecovery(error, type);

    // 设置错误计数重置定时器
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
        // Promise错误通常是API调用失败，尝试重新初始化API服务
        if (this.state.modules.apiService) {
          console.log("重新初始化API服务");
          this.reinitializeApiService();
        }
        break;

      case "javascript":
        // JavaScript错误可能是模块问题，尝试重新初始化相关模块
        if (error.message.includes("ImageViewer")) {
          console.log("重新初始化ImageViewer");
          this.reinitializeImageViewer();
        }
        break;

      case "resource":
        // 资源加载错误，显示用户友好的提示
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

    // 显示降级模式提示
    this.showFallbackUI();

    // 禁用复杂功能，只保留基本功能
    this.disableAdvancedFeatures();

    // 提供手动恢复选项
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

    // 绑定降级模式按钮事件
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
    // 禁用触摸交互
    if (this.state.modules.imageViewer) {
      // 移除触摸事件监听器
      const container = document.getElementById("image-container");
      if (container) {
        container.style.touchAction = "auto";
      }
    }

    // 禁用响应式管理器的复杂功能
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
    // 创建简单的图片查看器
    this.initializeBasicMode();
  }

  /**
   * 初始化基本模式
   */
  initializeBasicMode() {
    console.log("初始化基本模式");

    // 创建简单的API服务
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

    // 创建简单的UI控制器
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

    // 保存基本模式的服务
    this.basicServices = {
      apiService: basicApiService,
      uiController: basicUIController,
    };

    // 加载第一张图片
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
        // 清理现有实例
        this.state.modules.imageViewer = null;
      }

      // 创建新实例
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
    // 清理可能的内存泄漏
    this.cleanupResources();

    // 重新初始化核心模块
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

      // 初始化API服务
      this.state.modules.apiService = new ApiService();
      console.log("✓ API服务初始化完成");

      // 初始化UI控制器
      this.state.modules.uiController = new UIController();
      console.log("✓ UI控制器初始化完成");

      // 初始化响应式管理器
      this.state.modules.responsiveManager = new ResponsiveManager();
      console.log("✓ 响应式管理器初始化完成");

      // 初始化主图片查看器
      this.state.modules.imageViewer = new ImageViewer();
      console.log("✓ 图片查看器初始化完成");

      this.state.isInitialized = true;
      console.log("所有模块初始化完成");

      // 为了方便全局函数访问，添加便捷的属性访问器
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
    // 直接暴露常用模块到类的顶层属性，方便全局函数访问
    this.apiService = this.state.modules.apiService;
    this.uiController = this.state.modules.uiController;
    this.imageViewer = this.state.modules.imageViewer;
    this.responsiveManager = this.state.modules.responsiveManager;

    console.log("属性访问器已设置");
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
    // 页面可见性变化处理
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.handlePageHidden();
      } else {
        this.handlePageVisible();
      }
    });

    // 页面卸载处理
    window.addEventListener("beforeunload", () => {
      this.handleBeforeUnload();
    });

    // 页面卸载完成处理
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

    // 暂停图片预加载
    if (this.state.modules.imageViewer) {
      // 这里可以添加暂停预加载的逻辑
    }

    // 暂停响应式管理器的监听
    if (this.state.modules.responsiveManager) {
      // 这里可以添加暂停监听的逻辑
    }
  }

  /**
   * 处理页面显示
   */
  handlePageVisible() {
    console.log("页面已显示，恢复操作");

    // 恢复图片预加载
    if (this.state.modules.imageViewer) {
      // 这里可以添加恢复预加载的逻辑
    }

    // 恢复响应式管理器的监听
    if (this.state.modules.responsiveManager) {
      // 这里可以添加恢复监听的逻辑
    }
  }

  /**
   * 处理页面卸载前
   */
  handleBeforeUnload() {
    console.log("页面即将卸载，保存状态");

    // 保存当前状态到localStorage（如果需要）
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
    // 网络状态变化
    window.addEventListener("online", () => {
      console.log("网络已连接");
      this.handleNetworkOnline();
    });

    window.addEventListener("offline", () => {
      console.log("网络已断开");
      this.handleNetworkOffline();
    });

    // 内存压力处理（如果支持）
    if ("memory" in performance) {
      setInterval(() => {
        this.checkMemoryUsage();
      }, 30000); // 每30秒检查一次
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

    // 如果当前处于错误状态，尝试重新加载图片
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

      // 如果内存使用超过80%，执行清理
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

    // 清理图片缓存
    const images = document.querySelectorAll("img");
    images.forEach((img) => {
      if (img.src && img.src.startsWith("blob:")) {
        URL.revokeObjectURL(img.src);
      }
    });

    // 强制垃圾回收（如果支持）
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
      // 重新初始化API服务
      if (!this.state.modules.apiService) {
        this.state.modules.apiService = new ApiService();
      }

      // 重新初始化UI控制器
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

    // 暴露调试信息到全局
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

    // 销毁所有模块
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

    // 清理资源
    this.cleanupResources();

    // 移除事件监听器
    window.removeEventListener("online", this.handleNetworkOnline);
    window.removeEventListener("offline", this.handleNetworkOffline);

    // 标记为已销毁
    this.state.isDestroyed = true;

    console.log("应用销毁完成");
  }
}

// 应用初始化
document.addEventListener("DOMContentLoaded", () => {
  try {
    // 强制隐藏错误信息和加载指示器
    const errorMessage = document.getElementById("error-message");
    const loadingIndicator = document.getElementById("loading-indicator");
    
    if (errorMessage) {
      errorMessage.classList.add("hidden");
      errorMessage.style.display = "none !important";
      errorMessage.style.visibility = "hidden";
      console.log("强制隐藏错误信息");
    }
    
    if (loadingIndicator) {
      loadingIndicator.classList.add("hidden");
      loadingIndicator.style.display = "none";
      console.log("强制隐藏加载指示器");
    }
    
    // 添加额外的保护，定期检查并隐藏错误信息
    const hideErrorInterval = setInterval(() => {
      const errorMsg = document.getElementById("error-message");
      if (errorMsg && !errorMsg.classList.contains("hidden")) {
        errorMsg.classList.add("hidden");
        errorMsg.style.display = "none !important";
        errorMsg.style.visibility = "hidden";
        console.log("定期检查：强制隐藏错误信息");
      }
    }, 500);
    
    // 5秒后停止定期检查
    setTimeout(() => {
      clearInterval(hideErrorInterval);
    }, 5000);
    
    const app = new H5ImageViewerApp();
    console.log("H5 Image Viewer 已加载");

    // 将app实例暴露到全局，便于调试和测试
    window.imageViewerApp = app;

    // 如果URL包含debug参数，启用调试模式
    if (window.location.search.includes("debug=true")) {
      app.enableDebugMode();
    }
  } catch (error) {
    console.error("应用初始化失败:", error);

    // 显示初始化失败的提示
    document.body.innerHTML = `
            <div style="
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                flex-direction: column;
                font-family: Arial, sans-serif;
                text-align: center;
                padding: 20px;
            ">
                <h2>应用初始化失败</h2>
                <p>抱歉，应用无法正常启动</p>
                <p style="color: #666; font-size: 14px;">错误信息: ${error.message}</p>
                <button onclick="window.location.reload()" style="
                    padding: 10px 20px;
                    background: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-top: 20px;
                ">重新加载页面</button>
            </div>
        `;
  }
});

/**
 * 全局API切换函数
 */
window.switchApiSource = function () {
  console.log("切换API源");

  if (!window.imageViewerApp) {
    console.error("应用实例未找到，可能还在初始化中");
    alert("应用正在初始化中，请稍后重试");
    return;
  }

  // 直接访问应用实例的属性
  const apiService = window.imageViewerApp.apiService;
  const uiController = window.imageViewerApp.uiController;

  if (!apiService) {
    console.error("ApiService未初始化");
    alert("服务未初始化，请刷新页面重试");
    return;
  }

  const button = document.getElementById("api-switch-button");
  const buttonText = button ? button.querySelector(".button-text") : null;

  try {
    // 检查当前使用的API并切换
    if (apiService.isUsingCustomApi && apiService.isUsingCustomApi()) {
      // 从自定义API切换到重定向API（而不是直接禁用自定义API）
      apiService.switchApiSource("redirect");
      if (buttonText) buttonText.textContent = "新API";
      if (uiController) {
        uiController.showUserFeedback("已从自定义API切换到重定向API", 2000);
      }
    } else if (apiService.currentEndpoint === apiService.redirectEndpoint) {
      // 从重定向API切换到代理API
      apiService.switchApiSource("default");
      if (buttonText) buttonText.textContent = "旧API";
      if (uiController) {
        uiController.showUserFeedback("已切换到代理API", 1500);
      }
    } else {
      // 从代理API切换到重定向API
      apiService.switchApiSource("redirect");
      if (buttonText) buttonText.textContent = "新API";
      if (uiController) {
        uiController.showUserFeedback("已切换到重定向API", 1500);
      }
    }

    // 立即加载一张图片测试新的API
    setTimeout(() => {
      if (window.imageViewerApp && window.imageViewerApp.loadImage) {
        window.imageViewerApp.loadImage();
      }
    }, 500);
  } catch (error) {
    console.error("切换API时发生错误:", error);
    if (uiController) {
      uiController.showUserFeedback("切换API失败，请重试", 2000);
    } else {
      alert("切换API失败，请重试");
    }
  }
};
// 全局函数 - 自定义API弹窗管理
window.showCustomApiDialog = function () {
  console.log("显示自定义API弹窗");
  const dialog = document.getElementById("custom-api-dialog");
  const urlInput = document.getElementById("custom-api-url");
  const pathInput = document.getElementById("custom-json-path");

  if (!dialog) {
    console.error("自定义API弹窗元素未找到");
    alert("弹窗元素未找到，请刷新页面重试");
    return;
  }

  // 加载现有配置
  try {
    const config = localStorage.getItem("custom-api-config");
    if (config) {
      const parsed = JSON.parse(config);
      urlInput.value = parsed.url || "";
      pathInput.value = parsed.jsonPath || "";
    }
  } catch (error) {
    console.error("加载自定义API配置失败:", error);
  }

  // 显示弹窗
  dialog.classList.remove("hidden");

  // 聚焦到第一个输入框
  setTimeout(() => {
    urlInput.focus();
  }, 100);

  // 添加ESC键关闭功能
  const handleEscKey = (event) => {
    if (event.key === "Escape") {
      window.hideCustomApiDialog();
      document.removeEventListener("keydown", handleEscKey);
    }
  };
  document.addEventListener("keydown", handleEscKey);

  // 点击背景关闭弹窗
  const backdrop = dialog.querySelector(".dialog-backdrop");
  const handleBackdropClick = (event) => {
    if (event.target === backdrop) {
      window.hideCustomApiDialog();
      backdrop.removeEventListener("click", handleBackdropClick);
    }
  };
  backdrop.addEventListener("click", handleBackdropClick);
};

window.hideCustomApiDialog = function () {
  console.log("隐藏自定义API弹窗");
  const dialog = document.getElementById("custom-api-dialog");

  if (!dialog) {
    console.error("自定义API弹窗元素未找到");
    return;
  }

  // 隐藏弹窗
  dialog.classList.add("hidden");
};

window.saveCustomApi = function () {
  console.log("保存自定义API配置");
  const urlInput = document.getElementById("custom-api-url");
  const pathInput = document.getElementById("custom-json-path");

  if (!urlInput || !pathInput) {
    console.error("输入框元素未找到");
    return;
  }

  const url = urlInput.value.trim();
  const jsonPath = pathInput.value.trim();

  // 验证输入
  if (!url) {
    alert("请输入API URL");
    urlInput.focus();
    return;
  }

  if (!jsonPath) {
    alert("请输入JSON路径");
    pathInput.focus();
    return;
  }

  // 验证URL格式
  try {
    new URL(url);
  } catch (error) {
    alert("请输入有效的URL格式");
    urlInput.focus();
    return;
  }

  // 验证JSON路径格式（简单验证）
  if (
    !/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(jsonPath)
  ) {
    alert("JSON路径格式无效，请使用点分割格式，如: data.url 或 result.image");
    pathInput.focus();
    return;
  }

  try {
    // 获取全局应用实例
    if (window.imageViewerApp && window.imageViewerApp.apiService) {
      // 保存配置
      window.imageViewerApp.apiService.saveCustomApiConfig(url, jsonPath);

      // 切换到自定义API
      window.imageViewerApp.apiService.switchToCustomApi();

      // 显示成功消息
      if (window.imageViewerApp.uiController) {
        window.imageViewerApp.uiController.showUserFeedback(
          "自定义API配置已保存",
          2000
        );
      }

      // 关闭弹窗
      window.hideCustomApiDialog();

      // 立即加载一张图片测试
      setTimeout(() => {
        if (window.imageViewerApp.uiController) {
          window.imageViewerApp.uiController.showUserFeedback(
            "正在测试自定义API...",
            1500
          );
        }
        window.imageViewerApp.loadImage();
      }, 500);
    } else {
      console.error("应用实例未找到");
      alert("保存失败：应用未正确初始化");
    }
  } catch (error) {
    console.error("保存自定义API配置失败:", error);
    alert("保存失败：" + error.message);
  }
};

// 注意：switchApiSource函数已在上面定义，这里删除重复定义
