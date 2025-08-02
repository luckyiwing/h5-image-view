/**
 * 动画控制器 - 管理图片切换动画效果
 * 
 * 功能特性:
 * - 管理图片切换的动画效果
 * - 实现硬件加速和性能优化
 * - 提供动画期间的交互禁用机制
 * - 支持方向感知的动画效果
 */
class AnimationController {
    /**
     * 构造函数
     * @param {Object} options - 配置选项
     */
    constructor(options = {}) {
        this.options = {
            duration: 300, // 动画持续时间（毫秒）
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // 缓动函数
            enableHardwareAcceleration: true, // 是否启用硬件加速
            disableInteractionDuringAnimation: true, // 动画期间是否禁用交互
            ...options
        };

        // 状态管理
        this.isAnimating = false;
        this.currentAnimation = null;
        this.animationQueue = [];
        
        // 性能监控
        this.performanceMetrics = {
            animationCount: 0,
            averageDuration: 0,
            droppedFrames: 0
        };

        // 回调函数
        this.callbacks = {
            onStart: [],
            onComplete: [],
            onCancel: [],
            onPerformanceIssue: []
        };

        console.log('AnimationController 初始化完成', this.options);
    }

    /**
     * 执行滑动动画
     * @param {HTMLElement} currentElement - 当前图片元素
     * @param {HTMLElement} nextElement - 下一张图片元素
     * @param {string} direction - 动画方向 ('up', 'down')
     * @param {Object} customOptions - 自定义选项
     * @returns {Promise} 动画完成的Promise
     */
    slideAnimation(currentElement, nextElement, direction, customOptions = {}) {
        return new Promise((resolve, reject) => {
            try {
                // 检查是否正在动画中
                if (this.isAnimating && !customOptions.force) {
                    console.warn('动画正在进行中，跳过新动画');
                    reject(new Error('Animation already in progress'));
                    return;
                }

                // 验证元素
                if (!currentElement || !nextElement) {
                    reject(new Error('Invalid elements provided'));
                    return;
                }

                // 合并选项
                const animationOptions = { ...this.options, ...customOptions };

                // 创建滑动动画器
                const slideAnimator = new SlideAnimator(
                    currentElement,
                    nextElement,
                    direction,
                    animationOptions
                );

                // 开始动画
                this.startAnimation(slideAnimator, resolve, reject);

            } catch (error) {
                console.error('滑动动画执行失败:', error);
                reject(error);
            }
        });
    }

    /**
     * 开始动画
     * @param {SlideAnimator} animator - 动画器实例
     * @param {Function} resolve - 成功回调
     * @param {Function} reject - 失败回调
     */
    startAnimation(animator, resolve, reject) {
        // 设置动画状态
        this.isAnimating = true;
        this.currentAnimation = animator;

        // 禁用交互
        if (this.options.disableInteractionDuringAnimation) {
            this.disableInteraction();
        }

        // 通知动画开始
        this.notifyStart(animator);

        // 开始性能监控
        const startTime = performance.now();
        let frameCount = 0;
        let droppedFrames = 0;

        // 性能监控函数
        const monitorPerformance = () => {
            frameCount++;
            const currentTime = performance.now();
            const expectedFrames = Math.floor((currentTime - startTime) / 16.67); // 60fps
            
            if (frameCount < expectedFrames * 0.9) { // 如果实际帧数少于期望的90%
                droppedFrames++;
            }
        };

        // 执行动画
        animator.execute()
            .then(() => {
                // 动画完成
                const endTime = performance.now();
                const duration = endTime - startTime;

                // 更新性能指标
                this.updatePerformanceMetrics(duration, droppedFrames);

                // 重置状态
                this.resetAnimationState();

                // 通知动画完成
                this.notifyComplete(animator, duration);

                resolve();
            })
            .catch((error) => {
                // 动画失败
                console.error('动画执行失败:', error);
                
                // 重置状态
                this.resetAnimationState();

                // 通知动画取消
                this.notifyCancel(animator, error);

                reject(error);
            });

        // 设置性能监控
        if (this.options.enablePerformanceMonitoring) {
            const monitorInterval = setInterval(() => {
                if (!this.isAnimating) {
                    clearInterval(monitorInterval);
                    return;
                }
                monitorPerformance();
            }, 16.67); // 60fps
        }
    }

    /**
     * 取消当前动画
     * @returns {boolean} 取消是否成功
     */
    cancelAnimation() {
        if (!this.isAnimating || !this.currentAnimation) {
            return false;
        }

        try {
            // 取消动画器
            if (this.currentAnimation.cancel) {
                this.currentAnimation.cancel();
            }

            // 重置状态
            this.resetAnimationState();

            // 通知取消
            this.notifyCancel(this.currentAnimation, new Error('Animation cancelled'));

            console.log('动画已取消');
            return true;
        } catch (error) {
            console.error('取消动画失败:', error);
            return false;
        }
    }

    /**
     * 重置动画状态
     */
    resetAnimationState() {
        this.isAnimating = false;
        this.currentAnimation = null;

        // 恢复交互
        if (this.options.disableInteractionDuringAnimation) {
            this.enableInteraction();
        }
    }

    /**
     * 禁用交互
     */
    disableInteraction() {
        // 创建遮罩层阻止交互
        if (!this.interactionBlocker) {
            this.interactionBlocker = document.createElement('div');
            this.interactionBlocker.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                pointer-events: auto;
                background: transparent;
            `;
            document.body.appendChild(this.interactionBlocker);
        }
    }

    /**
     * 启用交互
     */
    enableInteraction() {
        if (this.interactionBlocker) {
            document.body.removeChild(this.interactionBlocker);
            this.interactionBlocker = null;
        }
    }

    /**
     * 更新性能指标
     * @param {number} duration - 动画持续时间
     * @param {number} droppedFrames - 丢帧数
     */
    updatePerformanceMetrics(duration, droppedFrames) {
        this.performanceMetrics.animationCount++;
        
        // 计算平均持续时间
        const totalDuration = this.performanceMetrics.averageDuration * (this.performanceMetrics.animationCount - 1) + duration;
        this.performanceMetrics.averageDuration = totalDuration / this.performanceMetrics.animationCount;
        
        // 累计丢帧数
        this.performanceMetrics.droppedFrames += droppedFrames;

        // 检查性能问题
        if (droppedFrames > 5 || duration > this.options.duration * 2) {
            this.notifyPerformanceIssue({
                duration,
                droppedFrames,
                expectedDuration: this.options.duration
            });
        }
    }

    /**
     * 获取性能指标
     * @returns {Object} 性能指标
     */
    getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * 检查是否正在动画
     * @returns {boolean} 是否正在动画
     */
    isAnimationInProgress() {
        return this.isAnimating;
    }

    /**
     * 设置动画选项
     * @param {Object} options - 新的选项
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
        console.log('动画选项已更新:', this.options);
    }

    /**
     * 注册开始回调
     * @param {Function} callback - 回调函数
     */
    onStart(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onStart.push(callback);
        }
    }

    /**
     * 注册完成回调
     * @param {Function} callback - 回调函数
     */
    onComplete(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onComplete.push(callback);
        }
    }

    /**
     * 注册取消回调
     * @param {Function} callback - 回调函数
     */
    onCancel(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onCancel.push(callback);
        }
    }

    /**
     * 注册性能问题回调
     * @param {Function} callback - 回调函数
     */
    onPerformanceIssue(callback) {
        if (typeof callback === 'function') {
            this.callbacks.onPerformanceIssue.push(callback);
        }
    }

    /**
     * 通知动画开始
     * @param {SlideAnimator} animator - 动画器
     */
    notifyStart(animator) {
        this.callbacks.onStart.forEach(callback => {
            try {
                callback(animator);
            } catch (error) {
                console.error('开始回调执行错误:', error);
            }
        });
    }

    /**
     * 通知动画完成
     * @param {SlideAnimator} animator - 动画器
     * @param {number} duration - 实际持续时间
     */
    notifyComplete(animator, duration) {
        this.callbacks.onComplete.forEach(callback => {
            try {
                callback(animator, duration);
            } catch (error) {
                console.error('完成回调执行错误:', error);
            }
        });
    }

    /**
     * 通知动画取消
     * @param {SlideAnimator} animator - 动画器
     * @param {Error} reason - 取消原因
     */
    notifyCancel(animator, reason) {
        this.callbacks.onCancel.forEach(callback => {
            try {
                callback(animator, reason);
            } catch (error) {
                console.error('取消回调执行错误:', error);
            }
        });
    }

    /**
     * 通知性能问题
     * @param {Object} metrics - 性能指标
     */
    notifyPerformanceIssue(metrics) {
        this.callbacks.onPerformanceIssue.forEach(callback => {
            try {
                callback(metrics);
            } catch (error) {
                console.error('性能问题回调执行错误:', error);
            }
        });
    }

    /**
     * 销毁控制器
     */
    destroy() {
        // 取消当前动画
        this.cancelAnimation();

        // 清理交互阻止器
        this.enableInteraction();

        // 清理回调
        Object.keys(this.callbacks).forEach(key => {
            this.callbacks[key] = [];
        });

        // 重置状态
        this.isAnimating = false;
        this.currentAnimation = null;
        this.animationQueue = [];

        console.log('AnimationController 已销毁');
    }
}

/**
 * 滑动动画器 - 处理具体的滑动动画逻辑
 */
class SlideAnimator {
    /**
     * 构造函数
     * @param {HTMLElement} currentElement - 当前元素
     * @param {HTMLElement} nextElement - 下一个元素
     * @param {string} direction - 动画方向
     * @param {Object} options - 动画选项
     */
    constructor(currentElement, nextElement, direction, options) {
        this.currentElement = currentElement;
        this.nextElement = nextElement;
        this.direction = direction; // 'up' 或 'down'
        this.options = options;
        
        this.isCancelled = false;
        this.animationId = null;
        
        // 准备动画
        this.prepareAnimation();
    }

    /**
     * 准备动画
     */
    prepareAnimation() {
        // 获取容器
        this.container = this.currentElement.parentElement;
        if (!this.container) {
            throw new Error('无法找到动画容器');
        }

        // 设置容器样式
        this.setupContainer();
        
        // 设置元素初始位置
        this.setupElements();
    }

    /**
     * 设置容器样式
     */
    setupContainer() {
        // 保存原始样式
        this.originalContainerStyle = {
            position: this.container.style.position,
            overflow: this.container.style.overflow
        };

        // 设置容器为相对定位，隐藏溢出
        Object.assign(this.container.style, {
            position: 'relative',
            overflow: 'hidden'
        });
    }

    /**
     * 设置元素样式
     */
    setupElements() {
        // 保存原始样式
        this.originalCurrentStyle = {
            position: this.currentElement.style.position,
            top: this.currentElement.style.top,
            left: this.currentElement.style.left,
            transform: this.currentElement.style.transform,
            transition: this.currentElement.style.transition
        };

        this.originalNextStyle = {
            position: this.nextElement.style.position,
            top: this.nextElement.style.top,
            left: this.nextElement.style.left,
            transform: this.nextElement.style.transform,
            transition: this.nextElement.style.transition,
            display: this.nextElement.style.display
        };

        // 设置当前元素样式
        Object.assign(this.currentElement.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            transform: 'translateY(0)',
            transition: 'none'
        });

        // 设置下一个元素样式
        const initialTransform = this.direction === 'up' ? 'translateY(100%)' : 'translateY(-100%)';
        Object.assign(this.nextElement.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            transform: initialTransform,
            transition: 'none',
            display: 'block'
        });

        // 启用硬件加速
        if (this.options.enableHardwareAcceleration) {
            this.currentElement.style.willChange = 'transform';
            this.nextElement.style.willChange = 'transform';
        }
    }

    /**
     * 执行动画
     * @returns {Promise} 动画完成的Promise
     */
    execute() {
        return new Promise((resolve, reject) => {
            if (this.isCancelled) {
                reject(new Error('Animation was cancelled'));
                return;
            }

            try {
                // 设置动画过渡
                const transition = `transform ${this.options.duration}ms ${this.options.easing}`;
                this.currentElement.style.transition = transition;
                this.nextElement.style.transition = transition;

                // 计算最终位置
                const currentFinalTransform = this.direction === 'up' ? 'translateY(-100%)' : 'translateY(100%)';
                const nextFinalTransform = 'translateY(0)';

                // 使用 requestAnimationFrame 确保样式已应用
                requestAnimationFrame(() => {
                    if (this.isCancelled) {
                        reject(new Error('Animation was cancelled'));
                        return;
                    }

                    // 开始动画
                    this.currentElement.style.transform = currentFinalTransform;
                    this.nextElement.style.transform = nextFinalTransform;

                    // 监听动画完成
                    const handleTransitionEnd = (event) => {
                        if (event.target === this.nextElement && event.propertyName === 'transform') {
                            this.nextElement.removeEventListener('transitionend', handleTransitionEnd);
                            
                            if (!this.isCancelled) {
                                this.cleanup();
                                resolve();
                            }
                        }
                    };

                    this.nextElement.addEventListener('transitionend', handleTransitionEnd);

                    // 设置超时保护
                    setTimeout(() => {
                        if (!this.isCancelled) {
                            this.nextElement.removeEventListener('transitionend', handleTransitionEnd);
                            this.cleanup();
                            resolve();
                        }
                    }, this.options.duration + 100);
                });

            } catch (error) {
                this.cleanup();
                reject(error);
            }
        });
    }

    /**
     * 取消动画
     */
    cancel() {
        this.isCancelled = true;
        this.cleanup();
    }

    /**
     * 清理动画
     */
    cleanup() {
        try {
            // 恢复容器样式
            if (this.originalContainerStyle) {
                Object.assign(this.container.style, this.originalContainerStyle);
            }

            // 恢复当前元素样式
            if (this.originalCurrentStyle) {
                Object.assign(this.currentElement.style, this.originalCurrentStyle);
            } else {
                // 如果没有原始样式，重置为默认值
                this.currentElement.style.position = '';
                this.currentElement.style.top = '';
                this.currentElement.style.left = '';
                this.currentElement.style.transform = '';
                this.currentElement.style.transition = '';
            }

            // 恢复下一个元素样式
            if (this.originalNextStyle) {
                Object.assign(this.nextElement.style, this.originalNextStyle);
            } else {
                // 如果没有原始样式，重置为默认值
                this.nextElement.style.position = '';
                this.nextElement.style.top = '';
                this.nextElement.style.left = '';
                this.nextElement.style.transform = '';
                this.nextElement.style.transition = '';
                this.nextElement.style.display = '';
            }

            // 清理硬件加速
            if (this.options.enableHardwareAcceleration) {
                this.currentElement.style.willChange = 'auto';
                this.nextElement.style.willChange = 'auto';
            }

        } catch (error) {
            console.error('动画清理失败:', error);
        }
    }
}

// 导出类
if (typeof window !== 'undefined') {
    window.AnimationController = AnimationController;
    window.SlideAnimator = SlideAnimator;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AnimationController, SlideAnimator };
}