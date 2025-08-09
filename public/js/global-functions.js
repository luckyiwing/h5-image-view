/**
 * 全局函数模块
 */

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
    if (apiService.isUsingCustomApi && apiService.isUsingCustomApi()) {
      apiService.switchApiSource("redirect");
      if (buttonText) buttonText.textContent = "新API";
      if (uiController) {
        uiController.showUserFeedback("已从自定义API切换到重定向API", 2000);
      }
    } else if (apiService.currentEndpoint === apiService.redirectEndpoint) {
      apiService.switchApiSource("default");
      if (buttonText) buttonText.textContent = "旧API";
      if (uiController) {
        uiController.showUserFeedback("已切换到代理API", 1500);
      }
    } else {
      apiService.switchApiSource("redirect");
      if (buttonText) buttonText.textContent = "新API";
      if (uiController) {
        uiController.showUserFeedback("已切换到重定向API", 1500);
      }
    }

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

/**
 * 显示自定义API弹窗
 */
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

  dialog.classList.remove("hidden");

  setTimeout(() => {
    urlInput.focus();
  }, 100);

  // ESC键关闭功能
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

/**
 * 隐藏自定义API弹窗
 */
window.hideCustomApiDialog = function () {
  console.log("隐藏自定义API弹窗");
  const dialog = document.getElementById("custom-api-dialog");

  if (!dialog) {
    console.error("自定义API弹窗元素未找到");
    return;
  }

  dialog.classList.add("hidden");
};

/**
 * 保存自定义API配置
 */
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

  // 验证JSON路径格式
  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*(\.[a-zA-Z_$][a-zA-Z0-9_$]*)*$/.test(jsonPath)) {
    alert("JSON路径格式无效，请使用点分割格式，如: data.url 或 result.image");
    pathInput.focus();
    return;
  }

  try {
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

/**
 * 切换历史面板显示/隐藏
 */
window.toggleHistoryPanel = function() {
  console.log("toggleHistoryPanel 被调用");
  
  // 检查应用实例是否存在
  if (!window.imageViewerApp) {
    console.error("应用实例未找到");
    alert('应用正在加载中，请稍后重试');
    return;
  }

  // 尝试新的模块化结构访问路径
  if (window.imageViewerApp.imageViewer && typeof window.imageViewerApp.imageViewer.toggleHistoryPanel === 'function') {
    console.log("使用新的模块化结构访问路径");
    window.imageViewerApp.imageViewer.toggleHistoryPanel();
    return;
  }

  // 兼容旧的访问路径
  if (window.imageViewerApp.state && 
      window.imageViewerApp.state.modules && 
      window.imageViewerApp.state.modules.imageViewer && 
      typeof window.imageViewerApp.state.modules.imageViewer.toggleHistoryPanel === 'function') {
    console.log("使用兼容的旧访问路径");
    window.imageViewerApp.state.modules.imageViewer.toggleHistoryPanel();
    return;
  }

  // 如果都找不到，尝试手动切换历史面板
  console.warn("未找到toggleHistoryPanel方法，尝试手动切换");
  const panel = document.getElementById('history-panel');
  if (panel) {
    const isOpen = panel.classList.contains('open');
    if (isOpen) {
      panel.classList.remove('open');
      console.log("手动关闭历史面板");
    } else {
      panel.classList.add('open');
      console.log("手动打开历史面板");
    }
  } else {
    console.error("历史面板元素未找到");
    alert('历史功能暂时不可用，请稍后重试');
  }
};

/**
 * 显示用户引导
 */
window.showUserGuide = function() {
  console.log("showUserGuide 被调用");
  
  // 检查应用实例是否存在
  if (!window.imageViewerApp) {
    console.error("应用实例未找到");
    alert('应用正在加载中，请稍后重试');
    return;
  }

  // 尝试新的模块化结构访问路径
  if (window.imageViewerApp.imageViewer && typeof window.imageViewerApp.imageViewer.handleHelpButtonClick === 'function') {
    console.log("使用新的模块化结构访问路径");
    window.imageViewerApp.imageViewer.handleHelpButtonClick();
    return;
  }

  // 兼容旧的访问路径
  if (window.imageViewerApp.state && 
      window.imageViewerApp.state.modules && 
      window.imageViewerApp.state.modules.imageViewer && 
      typeof window.imageViewerApp.state.modules.imageViewer.handleHelpButtonClick === 'function') {
    console.log("使用兼容的旧访问路径");
    window.imageViewerApp.state.modules.imageViewer.handleHelpButtonClick();
    return;
  }

  // 如果都找不到，显示简单的帮助信息
  console.warn("未找到handleHelpButtonClick方法，显示简单帮助");
  alert('操作指南：\n\n• 鼠标滚轮或方向键：切换图片\n• 触摸滑动：切换图片\n• 历史按钮：查看浏览历史\n• API按钮：切换图片源\n• 自定义按钮：设置自定义API');
};

/**
 * 显示历史状态信息
 */
window.showHistoryStatus = function() {
  if (window.imageViewerApp && window.imageViewerApp.imageViewer) {
    window.imageViewerApp.imageViewer.showHistoryStatus();
  } else {
    console.error("ImageViewer实例未找到");
  }
};

/**
 * 刷新当前图片
 */
window.refreshImage = function() {
  if (window.imageViewerApp && window.imageViewerApp.imageViewer) {
    window.imageViewerApp.imageViewer.refreshImage();
  } else {
    console.error("ImageViewer实例未找到");
  }
};

/**
 * 获取性能报告
 */
window.getPerformanceReport = function() {
  if (window.imageViewerApp && window.imageViewerApp.imageViewer) {
    return window.imageViewerApp.imageViewer.getPerformanceReport();
  } else {
    console.error("ImageViewer实例未找到");
    return null;
  }
};

/**
 * 清理缓存
 */
window.clearCache = function() {
  if (window.imageViewerApp && window.imageViewerApp.imageViewer) {
    window.imageViewerApp.imageViewer.clearCache();
  } else {
    console.error("ImageViewer实例未找到");
  }
};

/**
 * 输出性能报告到控制台
 */
window.logPerformanceReport = function() {
  if (window.imageViewerApp && window.imageViewerApp.imageViewer) {
    window.imageViewerApp.imageViewer.logPerformanceReport();
  } else {
    console.error("ImageViewer实例未找到");
  }
};