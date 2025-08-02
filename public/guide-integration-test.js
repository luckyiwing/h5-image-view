/**
 * 引导功能集成测试 - 验证设备检测和内容适配
 */

/**
 * 测试引导功能集成
 */
function testGuideIntegration() {
    console.log('=== 开始引导功能集成测试 ===');
    
    // 初始化组件
    const responsiveManager = new ResponsiveManager();
    const guideContentConfig = new GuideContentConfig();
    
    // 获取当前设备信息
    const deviceInfo = responsiveManager.getDeviceInfo();
    const guideDeviceInfo = responsiveManager.getGuideDeviceInfo();
    
    console.log('当前设备信息:', deviceInfo);
    console.log('引导优化设备信息:', guideDeviceInfo);
    
    // 获取设备特定的引导内容
    const guideContent = guideContentConfig.getContentForDevice(deviceInfo.type);
    console.log('设备引导内容:', guideContent);
    
    // 测试设备变化回调
    responsiveManager.onGuideContentUpdate((deviceType, deviceInfo) => {
        console.log('引导内容需要更新:', { deviceType, deviceInfo });
        const newContent = guideContentConfig.getContentForDevice(deviceType);
        console.log('新的引导内容:', newContent);
    });
    
    // 测试触摸支持变化回调
    responsiveManager.onTouchSupportChange((touchSupport, oldTouchSupport, deviceInfo) => {
        console.log('触摸支持状态变化:', { 
            from: oldTouchSupport, 
            to: touchSupport, 
            deviceInfo 
        });
    });
    
    // 验证引导功能特定方法
    console.log('=== 引导功能特定配置 ===');
    console.log('按钮尺寸:', responsiveManager.getGuideButtonSize());
    console.log('字体尺寸:', responsiveManager.getGuideFontSize());
    console.log('布局方向:', responsiveManager.getGuideLayout());
    console.log('触摸手势最小距离:', responsiveManager.getTouchGestureMinDistance());
    console.log('动画持续时间:', responsiveManager.getAnimationDuration());
    console.log('需要触摸友好UI:', responsiveManager.needsTouchFriendlyUI());
    console.log('引导最大宽度:', responsiveManager.getGuideMaxWidth());
    console.log('应使用紧凑布局:', responsiveManager.shouldUseCompactLayout());
    
    // 验证内容配置方法
    console.log('=== 内容配置验证 ===');
    console.log('支持的设备类型:', guideContentConfig.getSupportedDeviceTypes());
    console.log('支持的语言:', guideContentConfig.getSupportedLanguages());
    console.log('当前语言:', guideContentConfig.getCurrentLanguage());
    
    // 测试不同设备类型的内容
    ['mobile', 'tablet', 'desktop'].forEach(deviceType => {
        const content = guideContentConfig.getContentForDevice(deviceType);
        const instructions = guideContentConfig.getInstructionsForDevice(deviceType);
        const tips = guideContentConfig.getTipsForDevice(deviceType);
        const layout = guideContentConfig.getLayoutForDevice(deviceType);
        
        console.log(`${deviceType} 设备:`, {
            title: content?.title,
            instructionCount: instructions.length,
            tipCount: tips.length,
            layout: layout
        });
    });
    
    console.log('=== 引导功能集成测试完成 ===');
    
    return {
        responsiveManager,
        guideContentConfig,
        deviceInfo,
        guideDeviceInfo,
        guideContent
    };
}

// 模拟设备变化测试
function simulateDeviceChange() {
    console.log('=== 模拟设备变化测试 ===');
    
    const { responsiveManager, guideContentConfig } = testGuideIntegration();
    
    // 模拟窗口大小变化
    console.log('模拟窗口大小变化...');
    
    // 保存原始尺寸
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    
    // 模拟移动端尺寸
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 667
    });
    
    // 触发设备检测
    responsiveManager.detectDevice();
    console.log('模拟移动端设备信息:', responsiveManager.getDeviceInfo());
    
    // 模拟平板尺寸
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 1024
    });
    
    responsiveManager.detectDevice();
    console.log('模拟平板设备信息:', responsiveManager.getDeviceInfo());
    
    // 恢复原始尺寸
    Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: originalWidth
    });
    Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: originalHeight
    });
    
    responsiveManager.detectDevice();
    console.log('恢复原始设备信息:', responsiveManager.getDeviceInfo());
    
    console.log('=== 设备变化测试完成 ===');
}

// 如果在浏览器环境中，将测试函数添加到全局对象
if (typeof window !== 'undefined') {
    window.testGuideIntegration = testGuideIntegration;
    window.simulateDeviceChange = simulateDeviceChange;
    
    // 页面加载完成后自动运行测试
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', testGuideIntegration);
    } else {
        testGuideIntegration();
    }
}

// 如果在 Node.js 环境中，导出测试函数
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testGuideIntegration,
        simulateDeviceChange
    };
}