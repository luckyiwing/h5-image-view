/**
 * 用户引导内容配置 - 管理不同设备类型的引导内容
 * 
 * 功能特性:
 * - 创建设备特定的引导内容数据结构
 * - 定义桌面端、平板端、移动端的操作说明
 * - 实现内容的国际化支持基础结构
 * - 提供可视化操作演示配置
 */

/**
 * 引导内容配置类
 */
class GuideContentConfig {
    constructor() {
        this.currentLanguage = 'zh-CN'; // 默认中文
        this.supportedLanguages = ['zh-CN', 'en-US'];
        
        // 初始化内容配置
        this.initializeContent();
        
        console.log('GuideContentConfig 初始化完成');
    }

    /**
     * 初始化所有内容配置
     */
    initializeContent() {
        // 设备类型定义
        this.deviceTypes = {
            MOBILE: 'mobile',
            TABLET: 'tablet', 
            DESKTOP: 'desktop'
        };

        // 操作类型定义
        this.actionTypes = {
            SWIPE: 'swipe',
            SCROLL: 'scroll',
            KEYBOARD: 'keyboard',
            TOUCH: 'touch'
        };

        // 初始化多语言内容
        this.content = this.initializeMultiLanguageContent();
    }

    /**
     * 初始化多语言内容配置
     * @returns {Object} 多语言内容对象
     */
    initializeMultiLanguageContent() {
        return {
            'zh-CN': this.getChineseContent(),
            'en-US': this.getEnglishContent()
        };
    }

    /**
     * 获取中文内容配置
     * @returns {Object} 中文内容配置
     */
    getChineseContent() {
        return {
            // 桌面端内容
            [this.deviceTypes.DESKTOP]: {
                deviceType: this.deviceTypes.DESKTOP,
                title: '操作指南',
                subtitle: '了解如何浏览图片',
                instructions: [
                    {
                        id: 'desktop-scroll',
                        action: '鼠标滚轮',
                        description: '向上滚动查看上一张图片，向下滚动查看下一张图片',
                        icon: '🖱️',
                        gesture: {
                            type: this.actionTypes.SCROLL,
                            directions: ['up', 'down']
                        },
                        priority: 1
                    },
                    {
                        id: 'desktop-keyboard',
                        action: '键盘方向键',
                        description: '按↑键查看上一张，按↓键查看下一张图片',
                        icon: '⌨️',
                        gesture: {
                            type: this.actionTypes.KEYBOARD,
                            keys: ['ArrowUp', 'ArrowDown']
                        },
                        priority: 2
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'desktop-demo',
                    duration: 3000
                },
                tips: [
                    '滚轮和方向键都可以切换图片',
                    '图片会自动适配屏幕尺寸',
                    '支持预加载，切换更流畅'
                ],
                layout: {
                    orientation: 'horizontal',
                    maxWidth: '600px',
                    fontSize: '16px',
                    buttonSize: 'medium'
                }
            },

            // 平板端内容
            [this.deviceTypes.TABLET]: {
                deviceType: this.deviceTypes.TABLET,
                title: '操作指南',
                subtitle: '了解如何浏览图片',
                instructions: [
                    {
                        id: 'tablet-swipe',
                        action: '上下滑动',
                        description: '向上滑动查看下一张图片，向下滑动查看上一张图片',
                        icon: '👆',
                        gesture: {
                            type: this.actionTypes.SWIPE,
                            directions: ['up', 'down'],
                            minDistance: 50
                        },
                        priority: 1
                    },
                    {
                        id: 'tablet-touch',
                        action: '轻触操作',
                        description: '轻触图片区域外可显示操作提示',
                        icon: '👋',
                        gesture: {
                            type: this.actionTypes.TOUCH,
                            target: 'outside-image'
                        },
                        priority: 2
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'tablet-demo',
                    duration: 2500
                },
                tips: [
                    '滑动手势需要一定的速度和距离',
                    '支持横屏和竖屏模式',
                    '图片会自动居中显示'
                ],
                layout: {
                    orientation: 'vertical',
                    maxWidth: '500px',
                    fontSize: '18px',
                    buttonSize: 'large'
                }
            },

            // 移动端内容
            [this.deviceTypes.MOBILE]: {
                deviceType: this.deviceTypes.MOBILE,
                title: '操作指南',
                subtitle: '了解如何浏览图片',
                instructions: [
                    {
                        id: 'mobile-swipe',
                        action: '上下滑动',
                        description: '向上滑动查看下一张，向下滑动查看上一张',
                        icon: '📱',
                        gesture: {
                            type: this.actionTypes.SWIPE,
                            directions: ['up', 'down'],
                            minDistance: 30,
                            maxTime: 1000
                        },
                        priority: 1
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'mobile-demo',
                    duration: 2000
                },
                tips: [
                    '轻松滑动即可切换图片',
                    '支持快速连续滑动',
                    '自动适配屏幕方向'
                ],
                layout: {
                    orientation: 'vertical',
                    maxWidth: '100%',
                    fontSize: '16px',
                    buttonSize: 'large'
                }
            }
        };
    }

    /**
     * 获取英文内容配置
     * @returns {Object} 英文内容配置
     */
    getEnglishContent() {
        return {
            // Desktop content
            [this.deviceTypes.DESKTOP]: {
                deviceType: this.deviceTypes.DESKTOP,
                title: 'User Guide',
                subtitle: 'Learn how to browse images',
                instructions: [
                    {
                        id: 'desktop-scroll',
                        action: 'Mouse Wheel',
                        description: 'Scroll up for previous image, scroll down for next image',
                        icon: '🖱️',
                        gesture: {
                            type: this.actionTypes.SCROLL,
                            directions: ['up', 'down']
                        },
                        priority: 1
                    },
                    {
                        id: 'desktop-keyboard',
                        action: 'Arrow Keys',
                        description: 'Press ↑ for previous, press ↓ for next image',
                        icon: '⌨️',
                        gesture: {
                            type: this.actionTypes.KEYBOARD,
                            keys: ['ArrowUp', 'ArrowDown']
                        },
                        priority: 2
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'desktop-demo',
                    duration: 3000
                },
                tips: [
                    'Both wheel and arrow keys work',
                    'Images auto-fit to screen size',
                    'Preloading for smooth switching'
                ],
                layout: {
                    orientation: 'horizontal',
                    maxWidth: '600px',
                    fontSize: '16px',
                    buttonSize: 'medium'
                }
            },

            // Tablet content
            [this.deviceTypes.TABLET]: {
                deviceType: this.deviceTypes.TABLET,
                title: 'User Guide',
                subtitle: 'Learn how to browse images',
                instructions: [
                    {
                        id: 'tablet-swipe',
                        action: 'Swipe Up/Down',
                        description: 'Swipe up for next image, swipe down for previous image',
                        icon: '👆',
                        gesture: {
                            type: this.actionTypes.SWIPE,
                            directions: ['up', 'down'],
                            minDistance: 50
                        },
                        priority: 1
                    },
                    {
                        id: 'tablet-touch',
                        action: 'Touch',
                        description: 'Tap outside image area for hints',
                        icon: '👋',
                        gesture: {
                            type: this.actionTypes.TOUCH,
                            target: 'outside-image'
                        },
                        priority: 2
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'tablet-demo',
                    duration: 2500
                },
                tips: [
                    'Swipe with sufficient speed and distance',
                    'Supports both portrait and landscape',
                    'Images are automatically centered'
                ],
                layout: {
                    orientation: 'vertical',
                    maxWidth: '500px',
                    fontSize: '18px',
                    buttonSize: 'large'
                }
            },

            // Mobile content
            [this.deviceTypes.MOBILE]: {
                deviceType: this.deviceTypes.MOBILE,
                title: 'User Guide',
                subtitle: 'Learn how to browse images',
                instructions: [
                    {
                        id: 'mobile-swipe',
                        action: 'Swipe Up/Down',
                        description: 'Swipe up for next, swipe down for previous',
                        icon: '📱',
                        gesture: {
                            type: this.actionTypes.SWIPE,
                            directions: ['up', 'down'],
                            minDistance: 30,
                            maxTime: 1000
                        },
                        priority: 1
                    }
                ],
                visualDemo: {
                    type: 'animation',
                    content: 'mobile-demo',
                    duration: 2000
                },
                tips: [
                    'Easy swipe to switch images',
                    'Supports rapid consecutive swipes',
                    'Auto-adapts to screen orientation'
                ],
                layout: {
                    orientation: 'vertical',
                    maxWidth: '100%',
                    fontSize: '16px',
                    buttonSize: 'large'
                }
            }
        };
    }

    /**
     * 根据设备类型获取引导内容
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {Object|null} 引导内容对象
     */
    getContentForDevice(deviceType, language = null) {
        const lang = language || this.currentLanguage;
        
        try {
            if (!this.content[lang]) {
                console.warn(`不支持的语言: ${lang}，使用默认语言`);
                return this.content[this.currentLanguage][deviceType] || null;
            }

            if (!this.content[lang][deviceType]) {
                console.warn(`设备类型 ${deviceType} 的内容不存在`);
                return null;
            }

            const content = this.content[lang][deviceType];
            
            // 深拷贝以避免修改原始配置
            return JSON.parse(JSON.stringify(content));
        } catch (error) {
            console.error('获取设备内容失败:', error);
            return null;
        }
    }

    /**
     * 获取所有支持的设备类型
     * @returns {string[]} 设备类型数组
     */
    getSupportedDeviceTypes() {
        return Object.values(this.deviceTypes);
    }

    /**
     * 获取所有支持的语言
     * @returns {string[]} 语言代码数组
     */
    getSupportedLanguages() {
        return [...this.supportedLanguages];
    }

    /**
     * 设置当前语言
     * @param {string} language - 语言代码
     * @returns {boolean} 设置是否成功
     */
    setLanguage(language) {
        if (!this.supportedLanguages.includes(language)) {
            console.warn(`不支持的语言: ${language}`);
            return false;
        }

        this.currentLanguage = language;
        console.log(`语言已切换为: ${language}`);
        return true;
    }

    /**
     * 获取当前语言
     * @returns {string} 当前语言代码
     */
    getCurrentLanguage() {
        return this.currentLanguage;
    }

    /**
     * 根据设备类型获取操作说明列表
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {Array} 操作说明数组
     */
    getInstructionsForDevice(deviceType, language = null) {
        const content = this.getContentForDevice(deviceType, language);
        return content ? content.instructions : [];
    }

    /**
     * 根据设备类型获取提示信息
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {Array} 提示信息数组
     */
    getTipsForDevice(deviceType, language = null) {
        const content = this.getContentForDevice(deviceType, language);
        return content ? content.tips : [];
    }

    /**
     * 根据设备类型获取布局配置
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {Object} 布局配置对象
     */
    getLayoutForDevice(deviceType, language = null) {
        const content = this.getContentForDevice(deviceType, language);
        return content ? content.layout : {};
    }

    /**
     * 根据设备类型获取可视化演示配置
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {Object} 可视化演示配置
     */
    getVisualDemoForDevice(deviceType, language = null) {
        const content = this.getContentForDevice(deviceType, language);
        return content ? content.visualDemo : null;
    }

    /**
     * 验证设备类型是否有效
     * @param {string} deviceType - 设备类型
     * @returns {boolean} 是否有效
     */
    isValidDeviceType(deviceType) {
        return Object.values(this.deviceTypes).includes(deviceType);
    }

    /**
     * 验证语言代码是否有效
     * @param {string} language - 语言代码
     * @returns {boolean} 是否有效
     */
    isValidLanguage(language) {
        return this.supportedLanguages.includes(language);
    }

    /**
     * 获取设备类型的显示名称
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码，可选
     * @returns {string} 显示名称
     */
    getDeviceDisplayName(deviceType, language = null) {
        const lang = language || this.currentLanguage;
        
        const displayNames = {
            'zh-CN': {
                [this.deviceTypes.MOBILE]: '移动端',
                [this.deviceTypes.TABLET]: '平板端',
                [this.deviceTypes.DESKTOP]: '桌面端'
            },
            'en-US': {
                [this.deviceTypes.MOBILE]: 'Mobile',
                [this.deviceTypes.TABLET]: 'Tablet',
                [this.deviceTypes.DESKTOP]: 'Desktop'
            }
        };

        return displayNames[lang]?.[deviceType] || deviceType;
    }

    /**
     * 根据优先级排序操作说明
     * @param {Array} instructions - 操作说明数组
     * @returns {Array} 排序后的操作说明数组
     */
    sortInstructionsByPriority(instructions) {
        return [...instructions].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    }

    /**
     * 获取内容配置的统计信息
     * @returns {Object} 统计信息
     */
    getContentStats() {
        const stats = {
            languages: this.supportedLanguages.length,
            deviceTypes: Object.keys(this.deviceTypes).length,
            totalInstructions: 0,
            totalTips: 0
        };

        Object.keys(this.content).forEach(lang => {
            Object.keys(this.content[lang]).forEach(deviceType => {
                const content = this.content[lang][deviceType];
                stats.totalInstructions += content.instructions?.length || 0;
                stats.totalTips += content.tips?.length || 0;
            });
        });

        return stats;
    }

    /**
     * 添加自定义内容配置
     * @param {string} deviceType - 设备类型
     * @param {string} language - 语言代码
     * @param {Object} content - 内容配置
     * @returns {boolean} 添加是否成功
     */
    addCustomContent(deviceType, language, content) {
        try {
            if (!this.isValidLanguage(language)) {
                console.error(`不支持的语言: ${language}`);
                return false;
            }

            if (!this.content[language]) {
                this.content[language] = {};
            }

            this.content[language][deviceType] = content;
            console.log(`已添加自定义内容: ${deviceType} (${language})`);
            return true;
        } catch (error) {
            console.error('添加自定义内容失败:', error);
            return false;
        }
    }

    /**
     * 销毁配置管理器
     */
    destroy() {
        this.content = null;
        console.log('GuideContentConfig 已销毁');
    }
}

// 如果在浏览器环境中，将类添加到全局对象
if (typeof window !== 'undefined') {
    window.GuideContentConfig = GuideContentConfig;
}

// 如果在 Node.js 环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GuideContentConfig;
}