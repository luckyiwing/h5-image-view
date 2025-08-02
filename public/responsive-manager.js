/**
 * 响应式管理器类 - 处理设备适配和响应式设计
 */
class ResponsiveManager {
    constructor() {
        this.initializeState();
        this.detectDevice();
        this.setupEventListeners();
        this.initializeViewport();
        console.log('ResponsiveManager 初始化完成');
    }

    /**
     * 初始化状态
     */
    initializeState() {
        this.deviceInfo = {
            type: 'unknown', // 'desktop', 'tablet', 'mobile'
            orientation: 'portrait', // 'portrait', 'landscape'
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            pixelRatio: window.devicePixelRatio || 1,
            touchSupport: false,
            isMobile: false,
            isTablet: false,
            isDesktop: false
        };

        this.breakpoints = {
            mobile: 768,
            tablet: 1024,
            desktop: 1200
        };

        this.orientationChangeCallbacks = [];
        this.resizeCallbacks = [];
        this.deviceChangeCallbacks = [];
        
        // 引导功能相关回调
        this.guideContentUpdateCallbacks = [];
        this.touchSupportChangeCallbacks = [];
    }

    /**
     * 检测设备类型和特性
     */
    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;

        // 检测触摸支持
        this.deviceInfo.touchSupport = this.detectTouchSupport();

        // 检测设备类型
        this.deviceInfo.isMobile = this.detectMobile(userAgent, screenWidth);
        this.deviceInfo.isTablet = this.detectTablet(userAgent, screenWidth);
        this.deviceInfo.isDesktop = !this.deviceInfo.isMobile && !this.deviceInfo.isTablet;

        // 设置主要设备类型
        if (this.deviceInfo.isMobile) {
            this.deviceInfo.type = 'mobile';
        } else if (this.deviceInfo.isTablet) {
            this.deviceInfo.type = 'tablet';
        } else {
            this.deviceInfo.type = 'desktop';
        }

        // 检测屏幕方向
        this.deviceInfo.orientation = this.detectOrientation();

        // 更新屏幕尺寸信息
        this.updateScreenInfo();

        console.log('设备检测结果:', this.deviceInfo);
    }

    /**
     * 检测触摸支持
     * @returns {boolean} 是否支持触摸
     */
    detectTouchSupport() {
        return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            navigator.msMaxTouchPoints > 0
        );
    }

    /**
     * 检测移动设备
     * @param {string} userAgent - 用户代理字符串
     * @param {number} screenWidth - 屏幕宽度
     * @returns {boolean} 是否为移动设备
     */
    detectMobile(userAgent, screenWidth) {
        const mobileKeywords = [
            'mobile', 'android', 'iphone', 'ipod', 'blackberry', 
            'windows phone', 'opera mini', 'iemobile'
        ];

        const hasMobileKeyword = mobileKeywords.some(keyword => 
            userAgent.includes(keyword)
        );

        const isSmallScreen = screenWidth <= this.breakpoints.mobile;

        return hasMobileKeyword || (isSmallScreen && this.detectTouchSupport());
    }

    /**
     * 检测平板设备
     * @param {string} userAgent - 用户代理字符串
     * @param {number} screenWidth - 屏幕宽度
     * @returns {boolean} 是否为平板设备
     */
    detectTablet(userAgent, screenWidth) {
        const tabletKeywords = ['ipad', 'tablet', 'kindle', 'playbook', 'silk'];
        
        const hasTabletKeyword = tabletKeywords.some(keyword => 
            userAgent.includes(keyword)
        );

        const isTabletScreen = screenWidth > this.breakpoints.mobile && 
                              screenWidth <= this.breakpoints.tablet;

        return hasTabletKeyword || (isTabletScreen && this.detectTouchSupport());
    }

    /**
     * 检测屏幕方向
     * @returns {string} 屏幕方向
     */
    detectOrientation() {
        if (screen.orientation) {
            return screen.orientation.angle === 0 || screen.orientation.angle === 180 
                ? 'portrait' : 'landscape';
        }
        
        // 降级方案
        return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    }

    /**
     * 更新屏幕信息
     */
    updateScreenInfo() {
        this.deviceInfo.screenWidth = window.innerWidth;
        this.deviceInfo.screenHeight = window.innerHeight;
        this.deviceInfo.pixelRatio = window.devicePixelRatio || 1;
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听窗口大小变化
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));

        // 监听屏幕方向变化
        if (screen.orientation) {
            screen.orientation.addEventListener('change', () => {
                this.handleOrientationChange();
            });
        } else {
            // 降级方案
            window.addEventListener('orientationchange', () => {
                setTimeout(() => {
                    this.handleOrientationChange();
                }, 100); // 延迟以确保尺寸更新
            });
        }

        // 监听设备像素比变化（用于检测缩放）
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
            mediaQuery.addListener(() => {
                this.handleDevicePixelRatioChange();
            });
        }

        console.log('响应式事件监听器已设置');
    }

    /**
     * 初始化视口设置
     */
    initializeViewport() {
        // 确保视口meta标签正确设置
        let viewportMeta = document.querySelector('meta[name="viewport"]');
        
        if (!viewportMeta) {
            viewportMeta = document.createElement('meta');
            viewportMeta.name = 'viewport';
            document.head.appendChild(viewportMeta);
        }

        // 根据设备类型设置不同的视口配置
        if (this.deviceInfo.isMobile) {
            viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
        } else {
            viewportMeta.content = 'width=device-width, initial-scale=1.0';
        }

        console.log('视口设置已初始化:', viewportMeta.content);
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        const oldDeviceType = this.deviceInfo.type;
        const oldOrientation = this.deviceInfo.orientation;
        const oldTouchSupport = this.deviceInfo.touchSupport;

        // 重新检测设备信息
        this.detectDevice();

        // 检查设备类型是否发生变化
        if (oldDeviceType !== this.deviceInfo.type) {
            console.log(`设备类型变化: ${oldDeviceType} -> ${this.deviceInfo.type}`);
            this.notifyDeviceChange(oldDeviceType, this.deviceInfo.type);
        }

        // 检查方向是否发生变化
        if (oldOrientation !== this.deviceInfo.orientation) {
            console.log(`屏幕方向变化: ${oldOrientation} -> ${this.deviceInfo.orientation}`);
            this.notifyOrientationChange(oldOrientation, this.deviceInfo.orientation);
        }

        // 检查触摸支持是否发生变化
        if (oldTouchSupport !== this.deviceInfo.touchSupport) {
            console.log(`触摸支持变化: ${oldTouchSupport} -> ${this.deviceInfo.touchSupport}`);
            this.notifyTouchSupportChange(oldTouchSupport, this.deviceInfo.touchSupport);
        }

        // 通知尺寸变化
        this.notifyResize();

        console.log('窗口大小变化处理完成:', {
            width: this.deviceInfo.screenWidth,
            height: this.deviceInfo.screenHeight,
            type: this.deviceInfo.type,
            orientation: this.deviceInfo.orientation,
            touchSupport: this.deviceInfo.touchSupport
        });
    }

    /**
     * 处理屏幕方向变化
     */
    handleOrientationChange() {
        const oldOrientation = this.deviceInfo.orientation;
        
        // 更新方向信息
        this.deviceInfo.orientation = this.detectOrientation();
        this.updateScreenInfo();

        if (oldOrientation !== this.deviceInfo.orientation) {
            console.log(`屏幕方向变化: ${oldOrientation} -> ${this.deviceInfo.orientation}`);
            this.notifyOrientationChange(oldOrientation, this.deviceInfo.orientation);
        }
    }

    /**
     * 处理设备像素比变化
     */
    handleDevicePixelRatioChange() {
        const oldPixelRatio = this.deviceInfo.pixelRatio;
        this.deviceInfo.pixelRatio = window.devicePixelRatio || 1;

        console.log(`设备像素比变化: ${oldPixelRatio} -> ${this.deviceInfo.pixelRatio}`);
    }

    /**
     * 自动调整图片尺寸
     * @param {HTMLImageElement} imageElement - 图片元素
     * @returns {Object} 调整后的尺寸信息
     */
    adjustImageSize(imageElement) {
        if (!imageElement) {
            console.warn('adjustImageSize: 图片元素不存在');
            return null;
        }

        const containerWidth = this.deviceInfo.screenWidth;
        const containerHeight = this.deviceInfo.screenHeight;
        
        // 获取图片原始尺寸
        const naturalWidth = imageElement.naturalWidth;
        const naturalHeight = imageElement.naturalHeight;

        if (naturalWidth === 0 || naturalHeight === 0) {
            console.warn('adjustImageSize: 图片尺寸无效');
            return null;
        }

        // 计算缩放比例
        const scaleInfo = this.calculateImageScale(
            naturalWidth, 
            naturalHeight, 
            containerWidth, 
            containerHeight
        );

        // 应用尺寸调整
        this.applyImageSize(imageElement, scaleInfo);

        console.log('图片尺寸调整完成:', {
            original: { width: naturalWidth, height: naturalHeight },
            container: { width: containerWidth, height: containerHeight },
            final: { width: scaleInfo.width, height: scaleInfo.height },
            scale: scaleInfo.scale
        });

        return scaleInfo;
    }

    /**
     * 计算图片缩放比例和尺寸
     * @param {number} imageWidth - 图片宽度
     * @param {number} imageHeight - 图片高度
     * @param {number} containerWidth - 容器宽度
     * @param {number} containerHeight - 容器高度
     * @returns {Object} 缩放信息
     */
    calculateImageScale(imageWidth, imageHeight, containerWidth, containerHeight) {
        // 计算安全边距
        const margin = this.getImageMargin();
        const availableWidth = containerWidth - margin.horizontal;
        const availableHeight = containerHeight - margin.vertical;

        // 计算宽高比
        const imageAspectRatio = imageWidth / imageHeight;
        const containerAspectRatio = availableWidth / availableHeight;

        let scale, finalWidth, finalHeight;

        if (imageAspectRatio > containerAspectRatio) {
            // 图片更宽，以宽度为准
            scale = availableWidth / imageWidth;
            finalWidth = availableWidth;
            finalHeight = imageHeight * scale;
        } else {
            // 图片更高，以高度为准
            scale = availableHeight / imageHeight;
            finalWidth = imageWidth * scale;
            finalHeight = availableHeight;
        }

        // 确保不超过原始尺寸（避免放大模糊）
        if (scale > 1) {
            scale = 1;
            finalWidth = imageWidth;
            finalHeight = imageHeight;
        }

        return {
            scale,
            width: Math.round(finalWidth),
            height: Math.round(finalHeight),
            aspectRatio: imageAspectRatio
        };
    }

    /**
     * 获取图片边距设置
     * @returns {Object} 边距信息
     */
    getImageMargin() {
        const baseMargin = {
            mobile: { horizontal: 20, vertical: 40 },
            tablet: { horizontal: 40, vertical: 60 },
            desktop: { horizontal: 60, vertical: 80 }
        };

        return baseMargin[this.deviceInfo.type] || baseMargin.desktop;
    }

    /**
     * 应用图片尺寸
     * @param {HTMLImageElement} imageElement - 图片元素
     * @param {Object} scaleInfo - 缩放信息
     */
    applyImageSize(imageElement, scaleInfo) {
        // 设置图片尺寸
        imageElement.style.width = `${scaleInfo.width}px`;
        imageElement.style.height = `${scaleInfo.height}px`;
        
        // 确保图片居中显示
        imageElement.style.objectFit = 'contain';
        imageElement.style.objectPosition = 'center';

        // 根据设备类型应用特定样式
        this.applyDeviceSpecificStyles(imageElement);
    }

    /**
     * 应用设备特定样式
     * @param {HTMLImageElement} imageElement - 图片元素
     */
    applyDeviceSpecificStyles(imageElement) {
        // 移除之前的设备类样式
        imageElement.classList.remove('mobile-image', 'tablet-image', 'desktop-image');
        
        // 添加当前设备类样式
        imageElement.classList.add(`${this.deviceInfo.type}-image`);

        // 根据方向添加样式
        imageElement.classList.remove('portrait-image', 'landscape-image');
        imageElement.classList.add(`${this.deviceInfo.orientation}-image`);

        // 移动端特殊处理
        if (this.deviceInfo.isMobile) {
            imageElement.style.maxWidth = '100vw';
            imageElement.style.maxHeight = '100vh';
            imageElement.style.touchAction = 'manipulation';
        }
    }

    /**
     * 获取当前设备信息
     * @returns {Object} 设备信息
     */
    getDeviceInfo() {
        return { ...this.deviceInfo };
    }

    /**
     * 检查是否为移动设备
     * @returns {boolean} 是否为移动设备
     */
    isMobile() {
        return this.deviceInfo.isMobile;
    }

    /**
     * 检查是否为平板设备
     * @returns {boolean} 是否为平板设备
     */
    isTablet() {
        return this.deviceInfo.isTablet;
    }

    /**
     * 检查是否为桌面设备
     * @returns {boolean} 是否为桌面设备
     */
    isDesktop() {
        return this.deviceInfo.isDesktop;
    }

    /**
     * 检查是否支持触摸
     * @returns {boolean} 是否支持触摸
     */
    supportsTouchEvents() {
        return this.deviceInfo.touchSupport;
    }

    /**
     * 获取当前屏幕方向
     * @returns {string} 屏幕方向
     */
    getOrientation() {
        return this.deviceInfo.orientation;
    }

    /**
     * 检查是否为竖屏
     * @returns {boolean} 是否为竖屏
     */
    isPortrait() {
        return this.deviceInfo.orientation === 'portrait';
    }

    /**
     * 检查是否为横屏
     * @returns {boolean} 是否为横屏
     */
    isLandscape() {
        return this.deviceInfo.orientation === 'landscape';
    }

    /**
     * 获取引导功能优化的设备信息
     * @returns {Object} 引导功能设备信息
     */
    getGuideDeviceInfo() {
        return {
            ...this.deviceInfo,
            // 添加引导功能特定的信息
            guideButtonSize: this.getGuideButtonSize(),
            guideFontSize: this.getGuideFontSize(),
            guideLayout: this.getGuideLayout(),
            touchGestureMinDistance: this.getTouchGestureMinDistance(),
            animationDuration: this.getAnimationDuration()
        };
    }

    /**
     * 获取引导按钮尺寸
     * @returns {string} 按钮尺寸
     */
    getGuideButtonSize() {
        const sizeMap = {
            mobile: 'large',
            tablet: 'large', 
            desktop: 'medium'
        };
        return sizeMap[this.deviceInfo.type] || 'medium';
    }

    /**
     * 获取引导字体尺寸
     * @returns {string} 字体尺寸
     */
    getGuideFontSize() {
        const sizeMap = {
            mobile: '16px',
            tablet: '18px',
            desktop: '16px'
        };
        return sizeMap[this.deviceInfo.type] || '16px';
    }

    /**
     * 获取引导布局方向
     * @returns {string} 布局方向
     */
    getGuideLayout() {
        if (this.deviceInfo.type === 'desktop') {
            return 'horizontal';
        }
        return 'vertical';
    }

    /**
     * 获取触摸手势最小距离
     * @returns {number} 最小距离（像素）
     */
    getTouchGestureMinDistance() {
        const distanceMap = {
            mobile: 30,
            tablet: 50,
            desktop: 0 // 桌面端不使用触摸手势
        };
        return distanceMap[this.deviceInfo.type] || 30;
    }

    /**
     * 获取动画持续时间
     * @returns {number} 动画持续时间（毫秒）
     */
    getAnimationDuration() {
        const durationMap = {
            mobile: 2000,
            tablet: 2500,
            desktop: 3000
        };
        return durationMap[this.deviceInfo.type] || 2500;
    }

    /**
     * 检查是否需要触摸友好的UI调整
     * @returns {boolean} 是否需要触摸友好调整
     */
    needsTouchFriendlyUI() {
        return this.deviceInfo.touchSupport && (this.deviceInfo.isMobile || this.deviceInfo.isTablet);
    }

    /**
     * 获取引导内容的最大宽度
     * @returns {string} 最大宽度
     */
    getGuideMaxWidth() {
        const widthMap = {
            mobile: '100%',
            tablet: '500px',
            desktop: '600px'
        };
        return widthMap[this.deviceInfo.type] || '500px';
    }

    /**
     * 检查是否应该使用紧凑布局
     * @returns {boolean} 是否使用紧凑布局
     */
    shouldUseCompactLayout() {
        return this.deviceInfo.isMobile || 
               (this.deviceInfo.isTablet && this.deviceInfo.orientation === 'landscape');
    }

    /**
     * 注册方向变化回调
     * @param {Function} callback - 回调函数
     */
    onOrientationChange(callback) {
        if (typeof callback === 'function') {
            this.orientationChangeCallbacks.push(callback);
        }
    }

    /**
     * 注册尺寸变化回调
     * @param {Function} callback - 回调函数
     */
    onResize(callback) {
        if (typeof callback === 'function') {
            this.resizeCallbacks.push(callback);
        }
    }

    /**
     * 注册设备变化回调
     * @param {Function} callback - 回调函数
     */
    onDeviceChange(callback) {
        if (typeof callback === 'function') {
            this.deviceChangeCallbacks.push(callback);
        }
    }

    /**
     * 注册引导内容更新回调
     * @param {Function} callback - 回调函数，接收参数 (deviceType, deviceInfo)
     */
    onGuideContentUpdate(callback) {
        if (typeof callback === 'function') {
            this.guideContentUpdateCallbacks.push(callback);
        }
    }

    /**
     * 注册触摸支持变化回调
     * @param {Function} callback - 回调函数，接收参数 (touchSupport, deviceInfo)
     */
    onTouchSupportChange(callback) {
        if (typeof callback === 'function') {
            this.touchSupportChangeCallbacks.push(callback);
        }
    }

    /**
     * 通知方向变化
     * @param {string} oldOrientation - 旧方向
     * @param {string} newOrientation - 新方向
     */
    notifyOrientationChange(oldOrientation, newOrientation) {
        this.orientationChangeCallbacks.forEach(callback => {
            try {
                callback(newOrientation, oldOrientation, this.deviceInfo);
            } catch (error) {
                console.error('方向变化回调执行错误:', error);
            }
        });
    }

    /**
     * 通知尺寸变化
     */
    notifyResize() {
        this.resizeCallbacks.forEach(callback => {
            try {
                callback(this.deviceInfo);
            } catch (error) {
                console.error('尺寸变化回调执行错误:', error);
            }
        });
    }

    /**
     * 通知设备变化
     * @param {string} oldDeviceType - 旧设备类型
     * @param {string} newDeviceType - 新设备类型
     */
    notifyDeviceChange(oldDeviceType, newDeviceType) {
        this.deviceChangeCallbacks.forEach(callback => {
            try {
                callback(newDeviceType, oldDeviceType, this.deviceInfo);
            } catch (error) {
                console.error('设备变化回调执行错误:', error);
            }
        });

        // 通知引导内容需要更新
        this.notifyGuideContentUpdate(newDeviceType);
    }

    /**
     * 通知引导内容更新
     * @param {string} deviceType - 设备类型
     */
    notifyGuideContentUpdate(deviceType) {
        this.guideContentUpdateCallbacks.forEach(callback => {
            try {
                callback(deviceType, this.deviceInfo);
            } catch (error) {
                console.error('引导内容更新回调执行错误:', error);
            }
        });
    }

    /**
     * 通知触摸支持变化
     * @param {boolean} oldTouchSupport - 旧触摸支持状态
     * @param {boolean} newTouchSupport - 新触摸支持状态
     */
    notifyTouchSupportChange(oldTouchSupport, newTouchSupport) {
        this.touchSupportChangeCallbacks.forEach(callback => {
            try {
                callback(newTouchSupport, oldTouchSupport, this.deviceInfo);
            } catch (error) {
                console.error('触摸支持变化回调执行错误:', error);
            }
        });
    }

    /**
     * 防抖函数
     * @param {Function} func - 要防抖的函数
     * @param {number} delay - 延迟时间
     * @returns {Function} 防抖后的函数
     */
    debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * 销毁响应式管理器，清理资源
     */
    destroy() {
        // 清理事件监听器
        window.removeEventListener('resize', this.handleResize);
        window.removeEventListener('orientationchange', this.handleOrientationChange);
        
        if (screen.orientation) {
            screen.orientation.removeEventListener('change', this.handleOrientationChange);
        }

        // 清理回调数组
        this.orientationChangeCallbacks = [];
        this.resizeCallbacks = [];
        this.deviceChangeCallbacks = [];
        this.guideContentUpdateCallbacks = [];
        this.touchSupportChangeCallbacks = [];

        console.log('ResponsiveManager 已销毁');
    }
}

// 导出类（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ResponsiveManager;
}