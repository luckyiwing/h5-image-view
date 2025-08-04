const express = require("express");
const path = require("path");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

// 第三方API地址
const EXTERNAL_API_URL = "https://api.52vmy.cn/api/img/tu/girl";
const REDIRECT_API_URL =
  "https://www.onexiaolaji.cn/RandomPicture/api/?key=qq249663924&class=101&type=json";

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
 * API代理服务 - 处理JSON类型的图片API
 * 处理返回JSON格式的API，从响应体中提取图片URL
 */
function handleRedirectImageProxy(req, res) {
  // 设置CORS头
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  console.log("正在获取图片（JSON API）...");

  let responseHandled = false; // 添加响应状态跟踪

  // 使用https模块调用JSON API
  const request = https.get(REDIRECT_API_URL, (apiRes) => {
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

        // 检查API返回的状态码
        if (jsonData.code !== 200) {
          throw new Error(`API返回错误状态码: ${jsonData.code}`);
        }

        console.log("图片获取成功（JSON API）:", jsonData.url);
        console.log("API信息:", {
          amount: jsonData.amount,
          class: jsonData.class,
          classname: jsonData.classname,
          author: jsonData.author,
        });

        // 返回格式化的响应
        responseHandled = true;
        res.json({
          success: true,
          code: jsonData.code,
          msg: "获取成功",
          url: jsonData.url,
          amount: jsonData.amount,
          class: jsonData.class,
          classname: jsonData.classname,
          author: jsonData.author,
          timestamp: Date.now(),
        });
      } catch (parseError) {
        console.error("JSON API数据解析错误:", parseError.message);
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
    console.error("JSON API代理错误:", error.message);

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
