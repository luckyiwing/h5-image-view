/**
 * 本地存储管理器 - 管理用户偏好设置的本地存储
 * 
 * 功能特性:
 * - 管理用户引导显示状态
 * - 添加设置存储和读取方法
 * - 实现错误处理和降级方案
 * - 提供设置管理功能
 */

/**
 * 本地存储管理器类
 */
class LocalStorageManager {
    constructor(storageKey = 'h5-image-viewer-settings') {
        this.storageKey = storageKey;
        this.fallbackStorage = new Map(); // 内存存储作为降级方案
        this.isLocalStorageAvailable = this.checkLocalStorageAvailability();
        
        // 初始化默认设置
        this.defaultSettings = {
            guideShown: false,
            language: 'zh-CN',
            theme: 'dark',
            autoPreload: true,
            animationEnabled: true
        };
        
        console.log('LocalStorageManager 初始化完成, localStorage可用:', this.isLocalStorageAvailable);
    }

    /**
     * 检查localStorage是否可用
     * @returns {boolean} 是否可用
     */
    checkLocalStorageAvailability() {
        try {
            const testKey = '__localStorage_test__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('localStorage不可用，将使用内存存储:', error.message);
            return false;
        }
    }

    /**
     * 获取完整的设置对象
     * @returns {Object} 设置对象
     */
    getSettings() {
        try {
            if (this.isLocalStorageAvailable) {
                const stored = localStorage.getItem(this.storageKey);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // 合并默认设置和存储的设置
                    return { ...this.defaultSettings, ...parsed };
                }
            } else {
                // 使用内存存储
                const stored = this.fallbackStorage.get(this.storageKey);
                if (stored) {
                    return { ...this.defaultSettings, ...stored };
                }
            }
            
            // 返回默认设置
            return { ...this.defaultSettings };
            
        } catch (error) {
            console.error('获取设置失败:', error);
            return { ...this.defaultSettings };
        }
    }

    /**
     * 保存完整的设置对象
     * @param {Object} settings - 设置对象
     * @returns {boolean} 保存是否成功
     */
    saveSettings(settings) {
        try {
            const settingsToSave = { ...this.getSettings(), ...settings };
            
            if (this.isLocalStorageAvailable) {
                localStorage.setItem(this.storageKey, JSON.stringify(settingsToSave));
            } else {
                // 使用内存存储
                this.fallbackStorage.set(this.storageKey, settingsToSave);
            }
            
            console.log('设置已保存:', settingsToSave);
            return true;
            
        } catch (error) {
            console.error('保存设置失败:', error);
            
            // 尝试使用内存存储作为降级方案
            try {
                const settingsToSave = { ...this.getSettings(), ...settings };
                this.fallbackStorage.set(this.storageKey, settingsToSave);
                console.warn('已使用内存存储保存设置');
                return true;
            } catch (fallbackError) {
                console.error('内存存储也失败:', fallbackError);
                return false;
            }
        }
    }

    /**
     * 获取单个设置值
     * @param {string} key - 设置键
     * @param {*} defaultValue - 默认值
     * @returns {*} 设置值
     */
    getSetting(key, defaultValue = null) {
        try {
            const settings = this.getSettings();
            return settings.hasOwnProperty(key) ? settings[key] : defaultValue;
        } catch (error) {
            console.error(`获取设置 ${key} 失败:`, error);
            return defaultValue;
        }
    }

    /**
     * 设置单个设置值
     * @param {string} key - 设置键
     * @param {*} value - 设置值
     * @returns {boolean} 设置是否成功
     */
    setSetting(key, value) {
        try {
            const settings = this.getSettings();
            settings[key] = value;
            return this.saveSettings(settings);
        } catch (error) {
            console.error(`设置 ${key} 失败:`, error);
            return false;
        }
    }

    /**
     * 设置引导已显示状态
     * @param {boolean} shown - 是否已显示
     * @returns {boolean} 设置是否成功
     */
    setGuideShown(shown) {
        return this.setSetting('guideShown', Boolean(shown));
    }

    /**
     * 检查引导是否已显示
     * @returns {boolean} 是否已显示
     */
    hasGuideBeenShown() {
        return this.getSetting('guideShown', false);
    }

    /**
     * 设置语言
     * @param {string} language - 语言代码
     * @returns {boolean} 设置是否成功
     */
    setLanguage(language) {
        return this.setSetting('language', language);
    }

    /**
     * 获取语言
     * @returns {string} 语言代码
     */
    getLanguage() {
        return this.getSetting('language', 'zh-CN');
    }

    /**
     * 设置主题
     * @param {string} theme - 主题名称
     * @returns {boolean} 设置是否成功
     */
    setTheme(theme) {
        return this.setSetting('theme', theme);
    }

    /**
     * 获取主题
     * @returns {string} 主题名称
     */
    getTheme() {
        return this.getSetting('theme', 'dark');
    }

    /**
     * 设置自动预加载
     * @param {boolean} enabled - 是否启用
     * @returns {boolean} 设置是否成功
     */
    setAutoPreload(enabled) {
        return this.setSetting('autoPreload', Boolean(enabled));
    }

    /**
     * 获取自动预加载设置
     * @returns {boolean} 是否启用
     */
    getAutoPreload() {
        return this.getSetting('autoPreload', true);
    }

    /**
     * 设置动画启用状态
     * @param {boolean} enabled - 是否启用
     * @returns {boolean} 设置是否成功
     */
    setAnimationEnabled(enabled) {
        return this.setSetting('animationEnabled', Boolean(enabled));
    }

    /**
     * 获取动画启用状态
     * @returns {boolean} 是否启用
     */
    getAnimationEnabled() {
        return this.getSetting('animationEnabled', true);
    }

    /**
     * 清除所有设置
     * @returns {boolean} 清除是否成功
     */
    clearSettings() {
        try {
            if (this.isLocalStorageAvailable) {
                localStorage.removeItem(this.storageKey);
            }
            
            // 清除内存存储
            this.fallbackStorage.delete(this.storageKey);
            
            console.log('所有设置已清除');
            return true;
            
        } catch (error) {
            console.error('清除设置失败:', error);
            return false;
        }
    }

    /**
     * 重置为默认设置
     * @returns {boolean} 重置是否成功
     */
    resetToDefaults() {
        return this.saveSettings(this.defaultSettings);
    }

    /**
     * 导出设置
     * @returns {string} JSON格式的设置字符串
     */
    exportSettings() {
        try {
            const settings = this.getSettings();
            return JSON.stringify(settings, null, 2);
        } catch (error) {
            console.error('导出设置失败:', error);
            return null;
        }
    }

    /**
     * 导入设置
     * @param {string} settingsJson - JSON格式的设置字符串
     * @returns {boolean} 导入是否成功
     */
    importSettings(settingsJson) {
        try {
            const settings = JSON.parse(settingsJson);
            
            // 验证设置格式
            if (typeof settings !== 'object' || settings === null) {
                throw new Error('设置格式无效');
            }
            
            return this.saveSettings(settings);
            
        } catch (error) {
            console.error('导入设置失败:', error);
            return false;
        }
    }

    /**
     * 获取存储使用情况
     * @returns {Object} 存储使用情况信息
     */
    getStorageInfo() {
        const info = {
            isLocalStorageAvailable: this.isLocalStorageAvailable,
            storageKey: this.storageKey,
            usingFallback: false,
            dataSize: 0
        };

        try {
            if (this.isLocalStorageAvailable) {
                const stored = localStorage.getItem(this.storageKey);
                info.dataSize = stored ? stored.length : 0;
            } else {
                info.usingFallback = true;
                const stored = this.fallbackStorage.get(this.storageKey);
                info.dataSize = stored ? JSON.stringify(stored).length : 0;
            }
        } catch (error) {
            console.error('获取存储信息失败:', error);
        }

        return info;
    }

    /**
     * 检查设置是否存在
     * @param {string} key - 设置键
     * @returns {boolean} 是否存在
     */
    hasSetting(key) {
        try {
            const settings = this.getSettings();
            return settings.hasOwnProperty(key);
        } catch (error) {
            console.error(`检查设置 ${key} 是否存在失败:`, error);
            return false;
        }
    }

    /**
     * 删除单个设置
     * @param {string} key - 设置键
     * @returns {boolean} 删除是否成功
     */
    removeSetting(key) {
        try {
            const settings = this.getSettings();
            
            if (settings.hasOwnProperty(key)) {
                delete settings[key];
                return this.saveSettings(settings);
            }
            
            return true; // 设置不存在，认为删除成功
            
        } catch (error) {
            console.error(`删除设置 ${key} 失败:`, error);
            return false;
        }
    }

    /**
     * 批量设置多个值
     * @param {Object} settingsObject - 设置对象
     * @returns {boolean} 设置是否成功
     */
    setMultiple(settingsObject) {
        try {
            if (typeof settingsObject !== 'object' || settingsObject === null) {
                throw new Error('设置对象格式无效');
            }
            
            return this.saveSettings(settingsObject);
            
        } catch (error) {
            console.error('批量设置失败:', error);
            return false;
        }
    }

    /**
     * 获取所有设置键
     * @returns {string[]} 设置键数组
     */
    getSettingKeys() {
        try {
            const settings = this.getSettings();
            return Object.keys(settings);
        } catch (error) {
            console.error('获取设置键失败:', error);
            return [];
        }
    }

    /**
     * 监听存储变化（仅限localStorage）
     * @param {Function} callback - 回调函数
     */
    onStorageChange(callback) {
        if (!this.isLocalStorageAvailable || typeof callback !== 'function') {
            return;
        }

        const handleStorageChange = (event) => {
            if (event.key === this.storageKey) {
                try {
                    const newValue = event.newValue ? JSON.parse(event.newValue) : null;
                    const oldValue = event.oldValue ? JSON.parse(event.oldValue) : null;
                    callback(newValue, oldValue);
                } catch (error) {
                    console.error('处理存储变化事件失败:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        
        // 返回清理函数
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }

    /**
     * 销毁存储管理器
     */
    destroy() {
        try {
            // 清除内存存储
            this.fallbackStorage.clear();
            
            console.log('LocalStorageManager 已销毁');
        } catch (error) {
            console.error('销毁 LocalStorageManager 失败:', error);
        }
    }
}

// 如果在浏览器环境中，将类添加到全局对象
if (typeof window !== 'undefined') {
    window.LocalStorageManager = LocalStorageManager;
}

// 如果在 Node.js 环境中，导出模块
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalStorageManager;
}