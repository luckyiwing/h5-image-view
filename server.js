const express = require("express");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

// 第三方API地址
const EXTERNAL_API_URL = "https://api.52vmy.cn/api/img/tu/girl";
const REDIRECT_API_URL =
  "https://www.onexiaolaji.cn/RandomPicture/api/?key=qq249663924&type=4";

// 图片代理缓存配置
const IMAGE_PROXY_CONFIG = {
  enableProxy: process.env.ENABLE_IMAGE_PROXY === "true", // 环境变量控制是否启用图片代理
  cacheTimeout: 5 * 60 * 1000, // 5分钟缓存
  maxCacheSize: 50, // 最大缓存50张图片URL
  timeout: 15000, // 15秒超时
};

// 配置静态文件服务
app.use(express.static(path.join(__dirname, "public")));

/**
 * API代理服务 - 处理重定向类型的图片API
 * 处理返回302重定向的API，从location头中提取图片URL
 */
function handleRedirectImageProxy(req, res) {
  // 设置CORS头
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  console.log("正在获取图片（重定向API）...");

  let responseHandled = false; // 添加响应状态跟踪

  // 使用https模块调用重定向API
  const request = https.get(REDIRECT_API_URL, (apiRes) => {
    // 检查是否是重定向响应
    if (apiRes.statusCode === 302 || apiRes.statusCode === 301) {
      const imageUrl = apiRes.headers.location;

      if (!imageUrl) {
        console.error("重定向响应中缺少location头");
        if (!responseHandled) {
          responseHandled = true;
          res.status(500).json({
            success: false,
            code: 500,
            msg: "重定向响应格式错误",
            error: "Missing location header in redirect response",
            timestamp: Date.now(),
          });
        }
        return;
      }

      console.log("图片获取成功（重定向）:", imageUrl);

      // 返回格式化的响应
      if (!responseHandled) {
        responseHandled = true;
        res.json({
          success: true,
          code: 200,
          msg: "获取成功",
          url: imageUrl,
          timestamp: Date.now(),
        });
      }
    } else {
      // 如果不是重定向，尝试读取响应体
      let data = "";

      apiRes.on("data", (chunk) => {
        data += chunk;
      });

      apiRes.on("end", () => {
        console.error("期望重定向响应，但收到:", apiRes.statusCode, data);
        if (!responseHandled) {
          responseHandled = true;
          res.status(500).json({
            success: false,
            code: 500,
            msg: "期望重定向响应",
            error: `Expected redirect, got ${apiRes.statusCode}`,
            timestamp: Date.now(),
          });
        }
      });
    }
  });

  // 处理请求错误
  request.on("error", (error) => {
    console.error("重定向API代理错误:", error.message);

    if (!responseHandled) {
      responseHandled = true;
      res.status(500).json({
        success: false,
        code: 500,
        msg: "图片获取失败",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  });

  // 设置请求超时
  request.setTimeout(10000, () => {
    request.destroy();
    if (!responseHandled) {
      responseHandled = true;
      res.status(408).json({
        success: false,
        code: 408,
        msg: "请求超时",
        error: "Request timeout",
        timestamp: Date.now(),
      });
    }
  });
}

/**
 * API代理服务 - 获取图片
 * 处理对第三方API的代理转发，包含错误处理和响应格式化
 */
function handleImageProxy(req, res) {
  // 设置CORS头
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  console.log("正在获取图片...");

  let responseHandled = false; // 添加响应状态跟踪

  // 使用https模块调用第三方API
  const request = https.get(EXTERNAL_API_URL, (apiRes) => {
    let data = "";

    // 接收数据
    apiRes.on("data", (chunk) => {
      data += chunk;
    });

    // 数据接收完成
    apiRes.on("end", () => {
      if (responseHandled) return;

      try {
        const jsonData = JSON.parse(data);

        // 验证响应数据格式
        if (!jsonData || typeof jsonData.url !== "string") {
          throw new Error("API返回数据格式不正确");
        }

        console.log("图片获取成功:", jsonData.url);

        // 返回格式化的响应
        responseHandled = true;
        res.json({
          success: true,
          code: jsonData.code || 200,
          msg: jsonData.msg || "获取成功",
          url: jsonData.url,
          timestamp: Date.now(),
        });
      } catch (parseError) {
        console.error("数据解析错误:", parseError.message);
        responseHandled = true;
        res.status(500).json({
          success: false,
          code: 500,
          msg: "数据解析失败",
          error: parseError.message,
          timestamp: Date.now(),
        });
      }
    });
  });

  // 处理请求错误
  request.on("error", (error) => {
    console.error("API代理错误:", error.message);

    if (!responseHandled) {
      responseHandled = true;
      res.status(500).json({
        success: false,
        code: 500,
        msg: "图片获取失败",
        error: error.message,
        timestamp: Date.now(),
      });
    }
  });

  // 设置请求超时
  request.setTimeout(10000, () => {
    request.destroy();
    if (!responseHandled) {
      responseHandled = true;
      res.status(408).json({
        success: false,
        code: 408,
        msg: "请求超时",
        error: "Request timeout",
        timestamp: Date.now(),
      });
    }
  });
}

// API代理端点 - 获取图片
app.get("/api/image", handleImageProxy);

// API代理端点 - 获取图片（重定向API）
app.get("/api/image/redirect", handleRedirectImageProxy);

// 基础路由 - 服务主页面
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log(`H5 Image Viewer server is running on port ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`API代理端点: http://localhost:${PORT}/api/image`);
});

// 导出app和server用于测试
module.exports = { app, server, handleImageProxy, handleRedirectImageProxy };
