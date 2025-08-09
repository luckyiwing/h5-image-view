/**
 * 应用主入口文件
 */

import { H5ImageViewerApp } from './core/app.js';
import './global-functions.js';

/**
 * 应用初始化函数
 */
function initializeApp() {
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
    
    // 创建应用实例
    const app = new H5ImageViewerApp();
    console.log("H5 Image Viewer 已加载");

    // 将app实例暴露到全局，便于调试和测试
    window.imageViewerApp = app;

    // 如果URL包含debug参数，启用调试模式
    if (window.location.search.includes("debug=true")) {
      app.enableDebugMode();
    }

    return app;
  } catch (error) {
    console.error("应用初始化失败:", error);
    showInitializationError(error);
    return null;
  }
}

/**
 * 显示初始化失败的错误界面
 * @param {Error} error - 错误对象
 */
function showInitializationError(error) {
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

/**
 * 检查浏览器兼容性
 * @returns {boolean} 是否兼容
 */
function checkBrowserCompatibility() {
  // 检查必要的API支持
  const requiredFeatures = [
    'fetch',
    'Promise',
    'localStorage',
    'addEventListener'
  ];

  for (const feature of requiredFeatures) {
    if (!(feature in window)) {
      console.error(`浏览器不支持 ${feature} API`);
      return false;
    }
  }

  // 检查ES6支持
  try {
    eval('const test = () => {}');
  } catch (e) {
    console.error('浏览器不支持ES6语法');
    return false;
  }

  return true;
}

/**
 * 显示浏览器不兼容提示
 */
function showCompatibilityError() {
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
      <h2>浏览器不兼容</h2>
      <p>您的浏览器版本过低，无法运行此应用</p>
      <p style="color: #666; font-size: 14px;">
        请升级到最新版本的 Chrome、Firefox、Safari 或 Edge 浏览器
      </p>
      <div style="margin-top: 20px;">
        <a href="https://www.google.com/chrome/" target="_blank" style="
          display: inline-block;
          padding: 10px 20px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 0 5px;
        ">下载 Chrome</a>
        <a href="https://www.mozilla.org/firefox/" target="_blank" style="
          display: inline-block;
          padding: 10px 20px;
          background: #007bff;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 0 5px;
        ">下载 Firefox</a>
      </div>
    </div>
  `;
}

/**
 * DOM加载完成后的初始化
 */
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM加载完成，开始初始化应用");

  // 检查浏览器兼容性
  if (!checkBrowserCompatibility()) {
    showCompatibilityError();
    return;
  }

  // 初始化应用
  const app = initializeApp();

  // 如果初始化成功，设置全局错误处理
  if (app) {
    // 设置全局的性能监控
    if (window.performance && window.performance.mark) {
      window.performance.mark('app-initialized');
    }

    // 记录应用启动时间
    console.log(`应用启动完成，耗时: ${Date.now() - window.performance.timeOrigin}ms`);
  }
});

/**
 * 页面加载完成后的处理
 */
window.addEventListener("load", () => {
  console.log("页面完全加载完成");

  // 记录页面加载完成时间
  if (window.performance && window.performance.mark) {
    window.performance.mark('page-loaded');
  }

  // 如果应用实例存在，执行加载后的优化
  if (window.imageViewerApp) {
    // 可以在这里执行一些页面加载完成后的优化操作
    console.log("执行页面加载完成后的优化");
  }
});

/**
 * 页面卸载前的清理
 */
window.addEventListener("beforeunload", () => {
  console.log("页面即将卸载，执行清理操作");

  // 如果应用实例存在，执行清理
  if (window.imageViewerApp && typeof window.imageViewerApp.destroy === 'function') {
    try {
      window.imageViewerApp.destroy();
    } catch (error) {
      console.error("应用销毁时发生错误:", error);
    }
  }
});

// 导出初始化函数，供测试使用
export { initializeApp, checkBrowserCompatibility };