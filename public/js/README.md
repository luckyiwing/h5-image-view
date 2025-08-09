# H5 图片展示器 - 模块化架构

## 📁 项目结构

```
public/js/
├── config/
│   └── app-config.js          # 应用配置和常量
├── utils/
│   ├── helpers.js             # 工具函数
│   └── error-handler.js       # 错误处理工具
├── services/
│   └── api-service.js         # API服务模块
├── controllers/
│   └── ui-controller.js       # UI控制器
├── core/
│   ├── image-viewer.js        # 图片查看器核心逻辑
│   └── app.js                 # 主应用类
├── global-functions.js        # 全局函数
├── main.js                    # 应用入口文件
└── README.md                  # 本文件
```

## 🚀 模块说明

### 配置模块 (config/)
- **app-config.js**: 包含所有应用配置、常量和默认值

### 工具模块 (utils/)
- **helpers.js**: 通用工具函数，如防抖、节流、URL验证等
- **error-handler.js**: 统一的错误处理和分类逻辑

### 服务模块 (services/)
- **api-service.js**: 处理所有API相关的逻辑，包括重试、缓存、自定义API等

### 控制器模块 (controllers/)
- **ui-controller.js**: 管理UI状态、加载指示器、错误显示等

### 核心模块 (core/)
- **image-viewer.js**: 图片查看器的核心业务逻辑
- **app.js**: 主应用类，负责模块整合和生命周期管理

### 其他模块
- **global-functions.js**: 暴露给全局的函数，保持向后兼容
- **main.js**: 应用入口，负责初始化和浏览器兼容性检查

## 🔧 模块化优势

### 1. 代码组织
- 每个模块职责单一，便于维护
- 清晰的依赖关系
- 更好的代码复用性

### 2. 性能优化
- 按需加载模块
- 减少全局变量污染
- 更好的内存管理

### 3. 开发体验
- 便于单元测试
- 支持多人协作开发
- 更好的IDE支持

### 4. 兼容性
- 支持现代浏览器的ES6模块
- 为老旧浏览器提供备用方案
- 渐进式增强

## 📦 依赖关系

```
main.js
├── core/app.js
│   ├── services/api-service.js
│   │   ├── config/app-config.js
│   │   ├── utils/error-handler.js
│   │   └── utils/helpers.js
│   ├── controllers/ui-controller.js
│   │   ├── config/app-config.js
│   │   └── utils/error-handler.js
│   └── core/image-viewer.js
│       ├── services/api-service.js
│       ├── controllers/ui-controller.js
│       ├── config/app-config.js
│       └── utils/helpers.js
└── global-functions.js
```

## 🛠️ 使用方式

### 现代浏览器
```html
<script type="module" src="js/main.js"></script>
```

### 老旧浏览器
```html
<script nomodule src="app.js"></script>
```

## 🔄 迁移说明

原来的4000多行 `app.js` 文件已经被拆分为多个模块：

1. **配置提取**: 所有配置项移至 `config/app-config.js`
2. **工具函数分离**: 通用函数移至 `utils/helpers.js`
3. **错误处理统一**: 错误处理逻辑移至 `utils/error-handler.js`
4. **服务模块化**: API相关逻辑移至 `services/api-service.js`
5. **UI控制分离**: UI相关逻辑移至 `controllers/ui-controller.js`
6. **核心逻辑整理**: 主要业务逻辑保留在 `core/image-viewer.js`

## 🧪 开发和调试

### 启用调试模式
在URL中添加 `?debug=true` 参数即可启用调试模式。

### 性能监控
模块化版本保留了所有性能监控功能，可通过以下方式访问：
```javascript
// 获取性能报告
window.getPerformanceReport();

// 查看缓存状态
window.imageViewerApp.imageViewer.getCacheStats();

// 清理缓存
window.clearCache();
```

## 🔮 未来扩展

模块化架构为未来扩展提供了良好的基础：

1. **插件系统**: 可以轻松添加新的功能模块
2. **主题系统**: UI模块可以支持多主题切换
3. **国际化**: 配置模块可以支持多语言
4. **测试覆盖**: 每个模块都可以独立测试
5. **CDN优化**: 模块可以分别部署到CDN

## 📝 注意事项

1. **浏览器兼容性**: 确保目标浏览器支持ES6模块
2. **CORS设置**: 如果从不同域加载模块，需要正确配置CORS
3. **缓存策略**: 模块文件的缓存策略需要合理配置
4. **错误处理**: 模块加载失败时会自动回退到备用版本

## 🤝 贡献指南

1. 每个模块都应该有清晰的职责边界
2. 新增功能优先考虑模块化设计
3. 保持向后兼容性
4. 添加适当的错误处理和日志
5. 更新相关文档