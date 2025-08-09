/**
 * 应用配置文件
 */

export const APP_CONFIG = {
  // API配置
  api: {
    proxyEndpoint: "/api/image",
    redirectEndpoint: "/api/image/redirect",
    maxRetries: 3,
    retryDelay: 1000,
    minApiInterval: 1500,
    timeout: 5000
  },

  // 缓存配置
  cache: {
    maxCacheSize: 3,
    maxMemorySize: 15 * 1024 * 1024, // 15MB
    maxQueueSize: 10,
    maxHistorySize: 30
  },

  // UI配置
  ui: {
    loadingTimeout: 10000,
    feedbackDuration: 1500,
    animationDuration: 300,
    progressUpdateInterval: 1000
  },

  // 触摸配置
  touch: {
    minSwipeDistance: 50,
    maxSwipeTime: 1000,
    minSwipeVelocity: 0.1
  },

  // 性能配置
  performance: {
    preloadCount: 1,
    maxPreloadCount: 2,
    preloadDelay: 4000,
    adaptiveThreshold: 0.9
  },

  // 错误处理配置
  error: {
    maxErrorCount: 5,
    errorResetTime: 60000,
    retryDelay: 2000
  }
};

export const ERROR_CATEGORIES = {
  NETWORK_ERROR: "network",
  TIMEOUT_ERROR: "timeout", 
  SERVER_ERROR: "server",
  PARSE_ERROR: "parse",
  VALIDATION_ERROR: "validation",
  COMPATIBILITY_ERROR: "compatibility",
  UNKNOWN_ERROR: "unknown"
};

export const UI_STATES = {
  IDLE: "idle",
  LOADING: "loading", 
  LOADED: "loaded",
  ERROR: "error"
};

export const ANIMATION_DIRECTIONS = {
  UP: "up",
  DOWN: "down",
  LEFT: "left", 
  RIGHT: "right"
};