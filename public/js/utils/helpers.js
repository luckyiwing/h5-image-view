/**
 * 工具函数模块
 */

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 */
export function throttle(func, limit) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * 检查网络连接状态
 * @returns {boolean} 是否在线
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * 验证URL格式
 * @param {string} url - 要验证的URL
 * @returns {boolean} 是否为有效URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 从JSON响应中提取值
 * @param {Object} response - JSON响应对象
 * @param {string} path - 点分割路径
 * @returns {any} 提取的值
 */
export function extractFromJson(response, path) {
  if (!path) {
    throw new Error("JSON路径未指定");
  }

  const pathParts = path.split(".");
  let value = response;

  for (const part of pathParts) {
    if (value === null || value === undefined) {
      throw new Error(`JSON路径 "${path}" 中的 "${part}" 不存在`);
    }
    value = value[part];
  }

  return value;
}

/**
 * 获取设备类型的中文名称
 * @param {string} deviceType - 设备类型
 * @returns {string} 中文名称
 */
export function getDeviceTypeName(deviceType) {
  const names = {
    mobile: "移动端",
    tablet: "平板",
    desktop: "桌面端",
  };
  return names[deviceType] || deviceType;
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
export function generateRandomString(length = 8) {
  return Math.random().toString(36).substr(2, length);
}

/**
 * 深拷贝对象
 * @param {any} obj - 要拷贝的对象
 * @returns {any} 拷贝后的对象
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === "object") {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

/**
 * 获取占位符图片的Data URL
 * @returns {string} 占位符图片的Data URL
 */
export function getPlaceholderImage() {
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGYwIi8+CjxwYXRoIGQ9Ik00MCAyMEM0Ni42Mjc0IDIwIDUyIDI1LjM3MjYgNTIgMzJDNTIgMzguNjI3NCA0Ni42Mjc0IDQ0IDQwIDQ0QzMzLjM3MjYgNDQgMjggMzguNjI3NCAyOCAzMkMyOCAyNS4zNzI2IDMzLjM3MjYgMjAgNDAgMjBaIiBmaWxsPSIjY2NjIi8+CjxwYXRoIGQ9Ik0yMCA1Nkw2MCA1NkM2MiA1NiA2MCA1NCA2MCA1Mkw2MCA0OEM2MCA0NiA1OCA0NCA1NiA0NEwyNCA0NEMyMiA0NCAyMCA0NiAyMCA0OEwyMCA1MkMyMCA1NCAyMiA1NiAyMCA1NloiIGZpbGw9IiNjY2MiLz4KPC9zdmc+';
}