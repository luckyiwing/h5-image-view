/**
 * 用户引导管理器 - 管理用户引导的显示逻辑和状态
 * 
 * 功能特性:
 * - 管理用户引导的整个生命周期
 * - 首次访问自动显示
 * - 设备类型自动检测和内容适配
 * - 本地存储状态管理
 * - 响应式布局支持
 */

/**
 * 用户引导管理器类
 */
class UserGuideManager {
    constructor(options = {}) {
        // 配置选项
        this.options = {
            storageKey: options.storageKey || 'h5-image-viewer-settings',
            language: options.language || 'zh-CN',
            autoShow: options.autoShow !== false, // 默认自动显示
            showDelay: options.showDelay || 1000, // 显示延迟
            ...options
        };

        // 初始化状态
        this.isInitialized = false;
        this.isVisible = false;
        this.currentContent = null;
        this.overlay = null;
        
        // 事件回调
        this.callbacks = {
            show: [],
            hide: [],
            contentUpdate: [],
            error: []
        };

        // 初始化依赖组件
        this.initializeDependencies();
        
        console.log('UserGuideManager 初始化完成');
    }

    /**
     * 初始化依赖组件
     */
    initializeDependencies() {
        try {
            // 初始化错误处理器
            this.errorHandler = window.GuideErrorHandlers?.guideErrorHandler || 
                               new (window.GuideErrorHandlers?.GuideErrorHandler || class {
                                   logError() {}
                                   handleStorageError() { return true; }
                                   handleRenderError() { return null; }
                                   handleDeviceDetectionError() { return 'desktop'; }
                                   handleContentLoadError() { return null; }
                                   isComponentAvailable() { return true; }
                               })();
            
            // 初始化本地存储管理器
            this.localStorageManager = new LocalStorageManager(this.options.storageKey);
            
            // 初始化内容配置管理器
            this.contentConfig = new GuideContentConfig();
            this.contentConfig.setLanguage(this.options.language);
            
            // 初始化响应式管理器（如果存在）
            this.responsiveManager = window.responsiveManager || null;
            
            console.log('UserGuideManager 依赖组件初始化完成');
        } catch (error) {
            console.error('UserGuideManager 依赖组件初始化失败:', error);
            this.triggerError('依赖组件初始化失败', error);
            
            // 使用错误处理器记录错误
            if (this.errorHandler) {
                this.errorHandler.logError('依赖组件初始化', error);
            }
        }
    }

    /**
     * 初始化用户引导管理器
     * @returns {boolean} 初始化是否成功
     */
    initialize() {
        try {
            if (this.isInitialized) {
                console.warn('UserGuideManager 已经初始化');
                return false;
            }

            // 检查是否应该显示引导
            const shouldShow = this.shouldShowGuide();
            
            if (shouldShow && this.options.autoShow) {
                // 延迟显示引导
                setTimeout(() => {
                    this.showGuide();
                }, this.options.showDelay);
            }

            this.isInitialized = true;
            console.log('UserGuideManager 初始化成功');
            return shouldShow;
            
        } catch (error) {
            console.error('UserGuideManager 初始化失败:', error);
            this.triggerError('初始化失败', error);
            return false;
        }
    }

    /**
     * 判断是否应该显示引导
     * @returns {boolean} 是否应该显示
     */
    shouldShowGuide() {
        try {
            // 检查错误处理器是否可用
            if (!this.errorHandler.isComponentAvailable()) {
                console.warn('引导组件已禁用，跳过显示');
                return false;
            }

            // 检查本地存储中的状态
            const hasBeenShown = this.localStorageManager.hasGuideBeenShown();
            
            // 首次访问时显示引导
            return !hasBeenShown;
            
        } catch (error) {
            console.error('检查引导显示状态失败:', error);
            
            // 使用错误处理器处理存储错误
            if (this.errorHandler) {
                this.errorHandler.handleStorageError(error);
            }
            
            // 出错时默认不显示
            return false;
        }
    }

    /**
     * 显示用户引导
     * @param {boolean} forceShow - 是否强制显示（不影响自动显示状态）
     */
    showGuide(forceShow = false) {
        try {
            if (this.isVisible) {
                console.log('用户引导已经显示');
                return;
            }

            // 检查错误处理器是否可用
            if (!this.errorHandler.isComponentAvailable()) {
                console.warn('引导组件已禁用，无法显示');
                return;
            }

            // 获取当前设备类型
            const deviceType = this.getCurrentDeviceType();
            
            // 获取设备特定的内容
            let content = this.getDeviceSpecificContent(deviceType);
            
            if (!content) {
                // 使用错误处理器获取降级内容
                content = this.errorHandler.handleContentLoadError(
                    new Error(`无法获取设备类型 ${deviceType} 的引导内容`), 
                    deviceType
                );
                
                if (!content) {
                    throw new Error(`无法获取任何引导内容，包括降级内容`);
                }
            }

            // 创建并显示引导界面
            this.createOverlay(content);
            this.showOverlay();
            
            // 更新状态
            this.isVisible = true;
            this.currentContent = content;
            
            // 如果不是强制显示，标记为已显示
            if (!forceShow) {
                this.markAsShown();
            }
            
            // 触发显示事件
            this.triggerShow(content);
            
            console.log('用户引导已显示:', deviceType);
            
        } catch (error) {
            console.error('显示用户引导失败:', error);
            this.triggerError('显示引导失败', error);
            
            // 使用错误处理器记录错误
            if (this.errorHandler) {
                this.errorHandler.logError('显示引导', error);
            }
        }
    }

    /**
     * 隐藏用户引导
     */
    hideGuide() {
        try {
            if (!this.isVisible) {
                console.log('用户引导已经隐藏');
                return;
            }

            // 隐藏引导界面
            this.hideOverlay();
            
            // 更新状态
            this.isVisible = false;
            this.currentContent = null;
            
            // 触发隐藏事件
            this.triggerHide();
            
            console.log('用户引导已隐藏');
            
        } catch (error) {
            console.error('隐藏用户引导失败:', error);
            this.triggerError('隐藏引导失败', error);
        }
    }

    /**
     * 标记引导为已显示
     */
    markAsShown() {
        try {
            this.localStorageManager.setGuideShown(true);
            console.log('引导状态已标记为已显示');
        } catch (error) {
            console.error('标记引导状态失败:', error);
        }
    }

    /**
     * 获取当前设备类型
     * @returns {string} 设备类型
     */
    getCurrentDeviceType() {
        if (this.responsiveManager) {
            const deviceInfo = this.responsiveManager.getDeviceInfo();
            return deviceInfo.deviceType;
        }
        
        // 简单的设备检测回退方案
        const width = window.innerWidth;
        if (width <= 768) {
            return 'mobile';
        } else if (width <= 1024) {
            return 'tablet';
        } else {
            return 'desktop';
        }
    }

    /**
     * 获取设备特定的引导内容
     * @param {string} deviceType - 设备类型
     * @returns {Object|null} 引导内容
     */
    getDeviceSpecificContent(deviceType) {
        try {
            return this.contentConfig.getContentForDevice(deviceType, this.options.language);
        } catch (error) {
            console.error('获取设备特定内容失败:', error);
            return null;
        }
    }

    /**
     * 创建引导覆盖层
     * @param {Object} content - 引导内容
     */
    createOverlay(content) {
        // 移除现有的覆盖层
        this.removeOverlay();
        
        // 创建覆盖层容器
        this.overlay = document.createElement('div');
        this.overlay.className = 'guide-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-labelledby', 'guide-title');
        
        // 创建覆盖层内容
        this.overlay.innerHTML = this.generateOverlayHTML(content);
        
        // 绑定事件
        this.bindOverlayEvents();
        
        // 添加到页面
        document.body.appendChild(this.overlay);
        
        console.log('引导覆盖层已创建');
    }

    /**
     * 生成覆盖层HTML
     * @param {Object} content - 引导内容
     * @returns {string} HTML字符串
     */
    generateOverlayHTML(content) {
        const layout = content.layout || {};
        
        return `
            <div class="guide-backdrop" aria-hidden="true"></div>
            <div class="guide-content" style="max-width: ${layout.maxWidth || '500px'}">
                <div class="guide-header">
                    <h2 id="guide-title" class="guide-title">${content.title || '操作指南'}</h2>
                    <button class="guide-close" aria-label="关闭引导" title="关闭引导">×</button>
                </div>
                <div class="guide-body">
                    ${content.subtitle ? `<p class="guide-subtitle">${content.subtitle}</p>` : ''}
                    <div class="guide-instructions">
                        ${this.generateInstructionsHTML(content.instructions || [])}
                    </div>
                    ${content.tips ? this.generateTipsHTML(content.tips) : ''}
                </div>
                <div class="guide-footer">
                    <label class="guide-checkbox">
                        <input type="checkbox" id="dont-show-again">
                        <span>不再显示</span>
                    </label>
                    <button class="guide-got-it" type="button">知道了</button>
                </div>
            </div>
        `;
    }

    /**
     * 生成操作说明HTML
     * @param {Array} instructions - 操作说明数组
     * @returns {string} HTML字符串
     */
    generateInstructionsHTML(instructions) {
        if (!instructions || instructions.length === 0) {
            return '<p>暂无操作说明</p>';
        }

        // 按优先级排序
        const sortedInstructions = this.contentConfig.sortInstructionsByPriority(instructions);
        
        return sortedInstructions.map(instruction => `
            <div class="guide-instruction">
                <div class="instruction-icon">${instruction.icon || '📖'}</div>
                <div class="instruction-content">
                    <h3 class="instruction-action">${instruction.action}</h3>
                    <p class="instruction-description">${instruction.description}</p>
                </div>
            </div>
        `).join('');
    }

    /**
     * 生成提示信息HTML
     * @param {Array} tips - 提示信息数组
     * @returns {string} HTML字符串
     */
    generateTipsHTML(tips) {
        if (!tips || tips.length === 0) {
            return '';
        }

        return `
            <div class="guide-tips">
                <h4 class="tips-title">💡 小贴士</h4>
                <ul class="tips-list">
                    ${tips.map(tip => `<li>${tip}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    /**
     * 绑定覆盖层事件
     */
    bindOverlayEvents() {
        if (!this.overlay) return;

        // 关闭按钮事件
        const closeBtn = this.overlay.querySelector('.guide-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.handleCloseClick());
        }

        // "知道了"按钮事件
        const gotItBtn = this.overlay.querySelector('.guide-got-it');
        if (gotItBtn) {
            gotItBtn.addEventListener('click', () => this.handleGotItClick());
        }

        // 背景点击事件
        const backdrop = this.overlay.querySelector('.guide-backdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.handleBackdropClick());
        }

        // 键盘事件
        this.overlay.addEventListener('keydown', (event) => this.handleKeyDown(event));

        // 阻止滚动穿透
        this.overlay.addEventListener('wheel', (event) => event.preventDefault(), { passive: false });
        this.overlay.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false });
    }

    /**
     * 处理关闭按钮点击
     */
    handleCloseClick() {
        this.hideGuide();
    }

    /**
     * 处理"知道了"按钮点击
     */
    handleGotItClick() {
        // 检查"不再显示"选项
        const dontShowCheckbox = this.overlay.querySelector('#dont-show-again');
        if (dontShowCheckbox && dontShowCheckbox.checked) {
            this.markAsShown();
        }
        
        this.hideGuide();
    }

    /**
     * 处理背景点击
     */
    handleBackdropClick() {
        this.hideGuide();
    }

    /**
     * 处理键盘事件
     * @param {KeyboardEvent} event - 键盘事件
     */
    handleKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            this.hideGuide();
        }
    }

    /**
     * 显示覆盖层
     */
    showOverlay() {
        if (!this.overlay) return;

        // 设置初始状态
        this.overlay.style.opacity = '0';
        this.overlay.style.visibility = 'visible';
        
        // 添加显示动画
        requestAnimationFrame(() => {
            this.overlay.style.transition = 'opacity 0.3s ease';
            this.overlay.style.opacity = '1';
        });

        // 设置焦点到第一个可聚焦元素
        setTimeout(() => {
            const firstFocusable = this.overlay.querySelector('button, input, [tabindex]');
            if (firstFocusable) {
                firstFocusable.focus();
            }
        }, 100);
    }

    /**
     * 隐藏覆盖层
     */
    hideOverlay() {
        if (!this.overlay) return;

        // 添加隐藏动画
        this.overlay.style.transition = 'opacity 0.3s ease';
        this.overlay.style.opacity = '0';
        
        // 动画完成后移除元素
        setTimeout(() => {
            this.removeOverlay();
        }, 300);
    }

    /**
     * 移除覆盖层
     */
    removeOverlay() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        this.overlay = null;
    }

    /**
     * 更新设备类型变化
     * @param {string} deviceType - 新的设备类型
     */
    updateForDeviceChange(deviceType) {
        try {
            if (!this.isVisible) return;

            // 获取新的内容
            const newContent = this.getDeviceSpecificContent(deviceType);
            
            if (!newContent) {
                console.warn(`无法获取设备类型 ${deviceType} 的内容`);
                return;
            }

            // 更新当前内容
            this.currentContent = newContent;
            
            // 重新创建覆盖层
            this.createOverlay(newContent);
            this.showOverlay();
            
            // 触发内容更新事件
            this.triggerContentUpdate(newContent);
            
            console.log('引导内容已更新为设备类型:', deviceType);
            
        } catch (error) {
            console.error('更新设备类型失败:', error);
            this.triggerError('更新设备类型失败', error);
        }
    }

    /**
     * 注册事件回调
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (this.callbacks[event] && typeof callback === 'function') {
            this.callbacks[event].push(callback);
        }
    }

    /**
     * 移除事件回调
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }

    /**
     * 注册显示事件回调
     * @param {Function} callback - 回调函数
     */
    onShow(callback) {
        this.on('show', callback);
    }

    /**
     * 注册隐藏事件回调
     * @param {Function} callback - 回调函数
     */
    onHide(callback) {
        this.on('hide', callback);
    }

    /**
     * 注册内容更新事件回调
     * @param {Function} callback - 回调函数
     */
    onContentUpdate(callback) {
        this.on('contentUpdate', callback);
    }

    /**
     * 注册错误事件回调
     * @param {Function} callback - 回调函数
     */
    onError(callback) {
        this.on('error', callback);
    }

    /**
     * 触发显示事件
     * @param {Object} content - 引导内容
     */
    triggerShow(content) {
        this.callbacks.show.forEach(callback => {
            try {
                callback(content);
            } catch (error) {
                console.error('显示事件回调执行失败:', error);
            }
        });
    }

    /**
     * 触发隐藏事件
     */
    triggerHide() {
        this.callbacks.hide.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('隐藏事件回调执行失败:', error);
            }
        });
    }

    /**
     * 触发内容更新事件
     * @param {Object} content - 新的引导内容
     */
    triggerContentUpdate(content) {
        this.callbacks.contentUpdate.forEach(callback => {
            try {
                callback(content);
            } catch (error) {
                console.error('内容更新事件回调执行失败:', error);
            }
        });
    }

    /**
     * 触发错误事件
     * @param {string} message - 错误消息
     * @param {Error} error - 错误对象
     */
    triggerError(message, error) {
        this.callbacks.error.forEach(callback => {
            try {
                callback(message, error);
            } catch (callbackError) {
                console.error('错误事件回调执行失败:', callbackError);
            }
        });
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前状态
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            isVisible: this.isVisible,
            currentDeviceType: this.getCurrentDeviceType(),
            hasBeenShown: this.localStorageManager.hasGuideBeenShown()
        };
    }

    /**
     * 重置引导状态
     */
    reset() {
        try {
            // 隐藏引导
            this.hideGuide();
            
            // 清除本地存储状态
            this.localStorageManager.clearSettings();
            
            console.log('引导状态已重置');
        } catch (error) {
            console.error('重置引导状态失败:', error);
        }
    }

    /**
     * 销毁用户引导管理器
     */
    destroy() {
        try {
            // 隐藏引导
            this.hideGuide();
            
            // 清理事件回调
            Object.keys(this.callbacks).forEach(event => {
                this.callbacks[event] = [];
            });
            
            // 销毁依赖组件
            if (this.contentConfig) {
                this.contentConfig.destroy();
            }
            
            // 重置状态
            this.isInitialized = false;
            this.isVisible = false;
            this.currentContent = null;
            
            console.log('UserGuideManager 已销毁');
        } catch (error) {
            console.error('销毁 UserGuideManager 失败:', error);
        }
    }
}

// 如果在浏览器环境中，将类添加到全局对象
if (typeof window !== 'undefined') {
    window.UserGuideManager = UserGuideManager;
}

// 如果在 Node.js 环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UserGuideManager;
}