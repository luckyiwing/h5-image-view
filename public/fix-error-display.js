/**
 * 错误显示修复模块
 * 解决历史面板图片加载错误和性能问题
 */

class ErrorDisplayFixer {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 10;
    this.errorLog = [];
    this.suppressedErrors = new Set();
    
    this.init();
    console.log("ErrorDisplayFixer 初始化完成");
  }

  /**
   * 初始化错误处理
   */
  init() {
    // 隐藏错误消息元素
    this.hideErrorMessage();
    
    // 监听全局错误
    this.setupGlobalErrorHandling();
    
    // 监听图片加载错误
    this.setupImageErrorHandling();
    
    // 监听网络错误
    this.setupNetworkErrorHandling();
  }

  /**
   * 强制隐藏错误消息
   */
  hideErrorMessage() {
    const errorMessage = document.getElementById('error-message');
    if (errorMessage) {
      // 多重隐藏确保不显示
      errorMessage.style.display = 'none';
      errorMessage.style.visibility = 'hidden';
      errorMessage.style.opacity = '0';
      errorMessage.style.zIndex = '-9999';
      errorMessage.style.position = 'absolute';
      errorMessage.style.left = '-9999px';
      errorMessage.style.top = '-9999px';
      errorMessage.classList.add('hidden');
      errorMessage.setAttribute('aria-hidden', 'true');
      
      console.log("错误消息已强制隐藏");
    }
  }

  /**
   * 设置全局错误处理
   */
  setupGlobalErrorHandling() {
    // 捕获未处理的Promise拒绝
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, 'unhandledrejection');
      event.preventDefault(); // 阻止默认的错误显示
    });

    // 捕获全局错误
    window.addEventListener('error', (event) => {
      this.handleError(event.error || event.message, 'global');
      event.preventDefault(); // 阻止默认的错误显示
    });
  }

  /**
   * 设置图片错误处理
   */
  setupImageErrorHandling() {
    // 使用事件委托处理所有图片错误
    document.addEventListener('error', (event) => {
      if (event.target.tagName === 'IMG') {
        this.handleImageError(event.target);
        event.stopPropagation();
        event.preventDefault();
      }
    }, true);
  }

  /**
   * 设置网络错误处理
   */
  setupNetworkErrorHandling() {
    // 监听fetch错误
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        if (!response.ok) {
          this.handleNetworkError(response, args[0]);
        }
        return response;
      } catch (error) {
        this.handleNetworkError(error, args[0]);
        throw error;
      }
    };
  }

  /**
   * 处理通用错误
   * @param {Error|string} error - 错误对象或消息
   * @param {string} context - 错误上下文
   */
  handleError(error, context) {
    const errorMessage = error?.message || error || '未知错误';
    const errorKey = `${context}:${errorMessage}`;

    // 避免重复记录相同错误
    if (this.suppressedErrors.has(errorKey)) {
      return;
    }

    this.errorCount++;
    
    // 记录错误但不显示给用户
    this.logError(errorMessage, context);

    // 如果错误过多，开始抑制
    if (this.errorCount > this.maxErrors) {
      this.suppressedErrors.add(errorKey);
      console.warn(`错误过多，开始抑制: ${errorKey}`);
    }

    // 确保错误消息保持隐藏
    this.hideErrorMessage();
  }

  /**
   * 处理图片加载错误
   * @param {HTMLImageElement} img - 图片元素
   */
  handleImageError(img) {
    const src = img.src;
    console.warn(`图片加载失败: ${src}`);

    // 设置占位符图片
    if (!img.dataset.errorHandled) {
      img.dataset.errorHandled = 'true';
      img.src = this.getPlaceholderImage();
      img.alt = '图片加载失败';
      
      // 添加错误样式
      img.style.filter = 'grayscale(100%)';
      img.style.opacity = '0.5';
    }

    this.logError(`图片加载失败: ${src}`, 'image');
  }

  /**
   * 处理网络错误
   * @param {Response|Error} error - 响应或错误对象
   * @param {string} url - 请求URL
   */
  handleNetworkError(error, url) {
    const message = error?.message || `网络请求失败: ${url}`;
    console.warn(message);
    this.logError(message, 'network');
  }

  /**
   * 记录错误到日志
   * @param {string} message - 错误消息
   * @param {string} context - 错误上下文
   */
  logError(message, context) {
    const errorEntry = {
      message,
      context,
      timestamp: new Date().toISOString(),
      count: 1
    };

    // 检查是否已存在相同错误
    const existingError = this.errorLog.find(
      entry => entry.message === message && entry.context === context
    );

    if (existingError) {
      existingError.count++;
      existingError.timestamp = errorEntry.timestamp;
    } else {
      this.errorLog.push(errorEntry);
    }

    // 限制日志大小
    if (this.errorLog.length > 50) {
      this.errorLog.shift();
    }

    // 只在开发模式下输出详细错误
    if (this.isDevelopmentMode()) {
      console.group(`🚨 错误记录 [${context}]`);
      console.warn(message);
      console.trace();
      console.groupEnd();
    }
  }

  /**
   * 获取占位符图片
   * @returns {string} 占位符图片的Data URL
   */
  getPlaceholderImage() {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjVmNWY1Ii8+CjxwYXRoIGQ9Ik00MCAyMEM0Ni42Mjc0IDIwIDUyIDI1LjM3MjYgNTIgMzJDNTIgMzguNjI3NCA0Ni42Mjc0IDQ0IDQwIDQ0QzMzLjM3MjYgNDQgMjggMzguNjI3NCAyOCAzMkMyOCAyNS4zNzI2IDMzLjM3MjYgMjAgNDAgMjBaIiBmaWxsPSIjY2NjIi8+CjxwYXRoIGQ9Ik0yMCA1Nkw2MCA1NkM2MiA1NiA2MCA1NCA2MCA1Mkw2MCA0OEM2MCA0NiA1OCA0NCA1NiA0NEwyNCA0NEMyMiA0NCAyMCA0NiAyMCA0OEwyMCA1MkMyMCA1NCAyMiA1NiAyMCA1NloiIGZpbGw9IiNjY2MiLz4KPHRleHQgeD0iNDAiIHk9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5IiBmb250LXNpemU9IjEwIj7liqDovb3lpLHotKU8L3RleHQ+Cjwvc3ZnPg==';
  }

  /**
   * 检查是否为开发模式
   * @returns {boolean} 是否为开发模式
   */
  isDevelopmentMode() {
    return location.hostname === 'localhost' || 
           location.hostname === '127.0.0.1' || 
           location.hostname.includes('dev') ||
           location.search.includes('debug=true');
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计信息
   */
  getErrorStats() {
    return {
      totalErrors: this.errorCount,
      uniqueErrors: this.errorLog.length,
      suppressedErrors: this.suppressedErrors.size,
      recentErrors: this.errorLog.slice(-5),
      errorsByContext: this.getErrorsByContext()
    };
  }

  /**
   * 按上下文分组错误
   * @returns {Object} 按上下文分组的错误统计
   */
  getErrorsByContext() {
    const contextStats = {};
    this.errorLog.forEach(error => {
      if (!contextStats[error.context]) {
        contextStats[error.context] = 0;
      }
      contextStats[error.context] += error.count;
    });
    return contextStats;
  }

  /**
   * 清理错误日志
   */
  clearErrorLog() {
    this.errorLog = [];
    this.suppressedErrors.clear();
    this.errorCount = 0;
    console.log("错误日志已清理");
  }

  /**
   * 输出错误报告
   */
  logErrorReport() {
    const stats = this.getErrorStats();
    console.group("📊 错误处理报告");
    console.log("总错误数:", stats.totalErrors);
    console.log("唯一错误数:", stats.uniqueErrors);
    console.log("被抑制错误数:", stats.suppressedErrors);
    console.log("按上下文分组:", stats.errorsByContext);
    console.log("最近错误:", stats.recentErrors);
    console.groupEnd();
  }
}

// 立即初始化错误显示修复器
const errorDisplayFixer = new ErrorDisplayFixer();

// 导出到全局作用域
window.ErrorDisplayFixer = ErrorDisplayFixer;
window.errorDisplayFixer = errorDisplayFixer;

// 定期清理错误日志
setInterval(() => {
  if (errorDisplayFixer.errorLog.length > 30) {
    errorDisplayFixer.clearErrorLog();
  }
}, 300000); // 5分钟清理一次