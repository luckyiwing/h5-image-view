/**
 * API服务模块
 */

import { APP_CONFIG } from '../config/app-config.js';
import { errorHandler } from '../utils/error-handler.js';
import { delay, isValidUrl, extractFromJson } from '../utils/helpers.js';

/**
 * API服务类 - 处理与后端代理的通信
 */
export class ApiService {
  constructor() {
    this.proxyEndpoint = APP_CONFIG.api.proxyEndpoint;
    this.redirectEndpoint = APP_CONFIG.api.redirectEndpoint;
    this.currentEndpoint = this.redirectEndpoint;
    this.customEndpoint = null;
    this.customJsonPath = null;
    this.maxRetries = APP_CONFIG.api.maxRetries;
    this.retryDelay = APP_CONFIG.api.retryDelay;
    this.compatibility = window.browserCompatibility;

    // API调用优化
    this.lastApiCall = 0;
    this.minApiInterval = APP_CONFIG.api.minApiInterval;
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.isProcessingQueue = false;

    this.loadCustomApiConfig();
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
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;

    if (timeSinceLastCall < this.minApiInterval) {
      const waitTime = this.minApiInterval - timeSinceLastCall;
      console.log(`API调用频率限制，等待 ${waitTime}ms`);
      await delay(waitTime);
    }

    const requestKey = this.currentEndpoint;
    if (this.pendingRequests.has(requestKey)) {
      console.log("检测到重复请求，等待现有请求完成");
      return await this.pendingRequests.get(requestKey);
    }

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

    if (!this.compatibility.supports("fetch")) {
      console.warn("浏览器不支持Fetch API，使用兼容模式");
    }

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        let apiUrl = this.currentEndpoint;
        if (this.isUsingCustomApi()) {
          const separator = apiUrl.includes('?') ? '&' : '?';
          apiUrl = `${apiUrl}${separator}t=${Date.now()}&r=${Math.random().toString(36).substr(2, 9)}`;
        }
        
        console.log(`API调用尝试 ${attempt}/${this.maxRetries} (端点: ${apiUrl})`);

        const timeoutSignal = this.compatibility.createTimeoutSignal(APP_CONFIG.api.timeout);

        const response = await fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          signal: timeoutSignal,
        });

        if (!response.ok) {
          const error = new Error(`HTTP错误: ${response.status} ${response.statusText}`);
          error.statusCode = response.status;
          throw error;
        }

        const data = await response.json();
        const imageUrl = this.validateResponse(data);

        console.log("API调用成功，获取图片URL:", imageUrl);
        return imageUrl;
      } catch (error) {
        lastError = errorHandler.categorizeError(error);
        console.warn(`API调用失败 (尝试 ${attempt}/${this.maxRetries}):`, error.message);

        if (attempt === 1 && this.currentEndpoint === this.proxyEndpoint) {
          console.log("默认API失败，尝试切换到重定向API");
          this.switchApiSource("redirect");
          continue;
        }

        if (!errorHandler.shouldRetry(lastError, attempt, this.maxRetries)) {
          break;
        }

        if (attempt < this.maxRetries) {
          const delayTime = errorHandler.calculateRetryDelay(attempt, lastError, this.retryDelay);
          await delay(delayTime);
        }
      }
    }

    throw errorHandler.handleApiError(lastError);
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

    if (this.isUsingCustomApi() && this.customJsonPath) {
      return this.extractImageUrlFromJson(response, this.customJsonPath);
    }

    if (response.code !== undefined && response.code !== 200) {
      throw new Error(`API返回错误码: ${response.code}, 消息: ${response.msg || "未知错误"}`);
    }

    if (!response.url || typeof response.url !== "string") {
      throw new Error("API响应格式无效：缺少有效的图片URL");
    }

    if (!isValidUrl(response.url)) {
      throw new Error("API返回的图片URL格式无效");
    }

    return response.url;
  }

  /**
   * 从JSON响应中提取图片URL
   * @param {Object} response - API响应数据
   * @param {string} jsonPath - JSON路径
   * @returns {string} 图片URL
   */
  extractImageUrlFromJson(response, jsonPath) {
    try {
      console.log("API响应数据:", JSON.stringify(response, null, 2));
      console.log("JSON路径:", jsonPath);

      let value = extractFromJson(response, jsonPath);

      // 如果原路径失败，尝试常见的嵌套路径
      if (value === undefined && jsonPath === "pic") {
        console.log("原路径失败，尝试常见的嵌套路径...");
        const commonPaths = ["数据.pic", "data.pic", "result.pic", "response.pic"];
        
        for (const altPath of commonPaths) {
          try {
            value = extractFromJson(response, altPath);
            if (value && typeof value === "string") {
              console.log(`找到有效路径: ${altPath}`);
              if (this.customJsonPath === "pic") {
                console.log("自动更新JSON路径配置");
                this.customJsonPath = altPath;
                this.saveCustomApiConfig(this.customEndpoint, altPath);
              }
              break;
            }
          } catch (e) {
            continue;
          }
        }
      }

      console.log("提取到的值:", value, "类型:", typeof value);

      if (Array.isArray(value) && value.length > 0) {
        console.log("检测到数组，尝试获取第一个元素");
        value = value[0];
      }

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

      if (typeof value !== "string") {
        if (typeof value === "number") {
          value = String(value);
        } else {
          throw new Error(`JSON路径 "${jsonPath}" 指向的值不是字符串，实际类型: ${typeof value}`);
        }
      }

      const cleanedUrl = value.replace(/\\\//g, '/');
      
      if (!isValidUrl(cleanedUrl)) {
        throw new Error(`提取的值不是有效的URL: ${cleanedUrl}`);
      }

      return cleanedUrl;
    } catch (error) {
      throw new Error(`从JSON中提取图片URL失败: ${error.message}`);
    }
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
   * 检查网络连接状态
   * @returns {boolean} 是否在线
   */
  isOnline() {
    return navigator.onLine;
  }
}