/**
 * 错误处理工具模块
 */

import { ERROR_CATEGORIES } from '../config/app-config.js';

/**
 * 错误处理器类
 */
export class ErrorHandler {
  constructor() {
    this.errorCategories = ERROR_CATEGORIES;
  }

  /**
   * 对错误进行分类
   * @param {Error} error - 原始错误
   * @returns {Error} 分类后的错误
   */
  categorizeError(error) {
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
    } else {
      error.category = this.errorCategories.UNKNOWN_ERROR;
    }

    return error;
  }

  /**
   * 判断是否应该重试
   * @param {Error} error - 错误对象
   * @param {number} attempt - 当前尝试次数
   * @param {number} maxRetries - 最大重试次数
   * @returns {boolean} 是否应该重试
   */
  shouldRetry(error, attempt, maxRetries) {
    if (attempt >= maxRetries) {
      return false;
    }

    switch (error.category) {
      case this.errorCategories.NETWORK_ERROR:
      case this.errorCategories.TIMEOUT_ERROR:
        return true;

      case this.errorCategories.SERVER_ERROR:
        return error.statusCode >= 500;

      case this.errorCategories.PARSE_ERROR:
      case this.errorCategories.VALIDATION_ERROR:
      case this.errorCategories.COMPATIBILITY_ERROR:
        return false;

      default:
        return true;
    }
  }

  /**
   * 计算重试延迟时间
   * @param {number} attempt - 当前尝试次数
   * @param {Error} error - 错误对象
   * @param {number} baseDelay - 基础延迟时间
   * @returns {number} 延迟时间（毫秒）
   */
  calculateRetryDelay(attempt, error, baseDelay = 1000) {
    let delay = baseDelay;

    switch (error.category) {
      case this.errorCategories.NETWORK_ERROR:
        delay *= 2;
        break;
      case this.errorCategories.SERVER_ERROR:
        delay *= 1.5;
        break;
      default:
        break;
    }

    return delay * Math.pow(2, attempt - 1);
  }

  /**
   * 获取用户友好的错误消息
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的错误消息
   */
  getUserFriendlyMessage(error) {
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

    return error instanceof Error ? error : new Error("未知的API错误");
  }
}

// 创建全局错误处理器实例
export const errorHandler = new ErrorHandler();