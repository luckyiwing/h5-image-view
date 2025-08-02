/**
 * 网络诊断工具 - 帮助分析图片加载慢的原因
 */
class NetworkDiagnostic {
  constructor() {
    this.results = [];
  }

  /**
   * 诊断API响应时间
   */
  async diagnoseApiResponse() {
    console.log('🔍 开始诊断API响应时间...');
    
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/image', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      const endTime = performance.now();
      const apiTime = endTime - startTime;
      
      if (response.ok) {
        const data = await response.json();
        
        const result = {
          step: 'API调用',
          time: apiTime,
          status: 'success',
          url: data.url,
          message: `API响应时间: ${apiTime.toFixed(2)}ms`
        };
        
        this.results.push(result);
        console.log(`✅ ${result.message}`);
        
        return { success: true, data, time: apiTime };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
    } catch (error) {
      const endTime = performance.now();
      const apiTime = endTime - startTime;
      
      const result = {
        step: 'API调用',
        time: apiTime,
        status: 'error',
        message: `API调用失败: ${error.message} (耗时: ${apiTime.toFixed(2)}ms)`,
        error: error.message
      };
      
      this.results.push(result);
      console.error(`❌ ${result.message}`);
      
      return { success: false, error, time: apiTime };
    }
  }

  /**
   * 诊断图片资源加载时间
   */
  async diagnoseImageLoading(imageUrl) {
    console.log('🔍 开始诊断图片资源加载时间...');
    
    return new Promise((resolve) => {
      const startTime = performance.now();
      const img = new Image();
      
      img.onload = () => {
        const endTime = performance.now();
        const imageTime = endTime - startTime;
        
        const result = {
          step: '图片加载',
          time: imageTime,
          status: 'success',
          url: imageUrl,
          message: `图片加载时间: ${imageTime.toFixed(2)}ms`,
          imageSize: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        };
        
        this.results.push(result);
        console.log(`✅ ${result.message}`);
        console.log(`📐 图片尺寸: ${img.naturalWidth}x${img.naturalHeight}`);
        
        resolve({ success: true, time: imageTime, image: img });
      };
      
      img.onerror = () => {
        const endTime = performance.now();
        const imageTime = endTime - startTime;
        
        const result = {
          step: '图片加载',
          time: imageTime,
          status: 'error',
          url: imageUrl,
          message: `图片加载失败 (耗时: ${imageTime.toFixed(2)}ms)`,
          error: '图片资源无法加载'
        };
        
        this.results.push(result);
        console.error(`❌ ${result.message}`);
        
        resolve({ success: false, time: imageTime, error: '图片加载失败' });
      };
      
      img.src = imageUrl;
    });
  }

  /**
   * 执行完整诊断
   */
  async runFullDiagnosis() {
    console.log('🚀 开始完整网络诊断...');
    this.results = [];
    
    const totalStartTime = performance.now();
    
    // 1. 诊断API响应
    const apiResult = await this.diagnoseApiResponse();
    
    if (!apiResult.success) {
      console.log('❌ API调用失败，无法继续诊断图片加载');
      return this.generateReport();
    }
    
    // 2. 诊断图片加载
    const imageResult = await this.diagnoseImageLoading(apiResult.data.url);
    
    const totalEndTime = performance.now();
    const totalTime = totalEndTime - totalStartTime;
    
    // 3. 添加总时间统计
    this.results.push({
      step: '总耗时',
      time: totalTime,
      status: 'info',
      message: `总加载时间: ${totalTime.toFixed(2)}ms`
    });
    
    console.log(`⏱️ 总加载时间: ${totalTime.toFixed(2)}ms`);
    
    return this.generateReport();
  }

  /**
   * 生成诊断报告
   */
  generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      results: this.results,
      analysis: this.analyzeResults(),
      recommendations: this.getRecommendations()
    };
    
    console.log('📊 诊断报告:', report);
    return report;
  }

  /**
   * 分析结果
   */
  analyzeResults() {
    const apiResult = this.results.find(r => r.step === 'API调用');
    const imageResult = this.results.find(r => r.step === '图片加载');
    const totalResult = this.results.find(r => r.step === '总耗时');
    
    const analysis = {
      apiTime: apiResult?.time || 0,
      imageTime: imageResult?.time || 0,
      totalTime: totalResult?.time || 0,
      bottleneck: null,
      severity: 'normal'
    };
    
    // 判断瓶颈
    if (apiResult && imageResult) {
      if (apiResult.time > imageResult.time * 2) {
        analysis.bottleneck = 'api';
        analysis.bottleneckDescription = 'API服务器响应慢';
      } else if (imageResult.time > apiResult.time * 2) {
        analysis.bottleneck = 'image';
        analysis.bottleneckDescription = '图片资源服务器响应慢';
      } else {
        analysis.bottleneck = 'balanced';
        analysis.bottleneckDescription = 'API和图片加载时间相当';
      }
    }
    
    // 判断严重程度
    if (analysis.totalTime > 5000) {
      analysis.severity = 'severe';
    } else if (analysis.totalTime > 2000) {
      analysis.severity = 'moderate';
    }
    
    return analysis;
  }

  /**
   * 获取优化建议
   */
  getRecommendations() {
    const analysis = this.analyzeResults();
    const recommendations = [];
    
    if (analysis.bottleneck === 'api') {
      recommendations.push({
        type: 'api',
        title: 'API服务器优化',
        suggestions: [
          '考虑使用CDN加速API请求',
          '实现API响应缓存',
          '考虑更换更快的API服务提供商',
          '增加API请求超时重试机制'
        ]
      });
    }
    
    if (analysis.bottleneck === 'image') {
      recommendations.push({
        type: 'image',
        title: '图片资源优化',
        suggestions: [
          '使用图片CDN服务',
          '实现图片预加载策略',
          '考虑图片压缩和格式优化',
          '增加图片加载失败重试机制'
        ]
      });
    }
    
    if (analysis.severity === 'severe') {
      recommendations.push({
        type: 'general',
        title: '网络环境优化',
        suggestions: [
          '检查本地网络连接质量',
          '考虑使用更快的DNS服务器',
          '检查是否有网络代理影响',
          '考虑在不同网络环境下测试'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * 显示诊断结果到页面
   */
  displayResults(report) {
    // 创建结果显示容器
    let resultContainer = document.getElementById('diagnostic-results');
    if (!resultContainer) {
      resultContainer = document.createElement('div');
      resultContainer.id = 'diagnostic-results';
      resultContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        right: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 8px;
        font-family: monospace;
        font-size: 12px;
        z-index: 10000;
        max-height: 80vh;
        overflow-y: auto;
        border: 1px solid #333;
      `;
      document.body.appendChild(resultContainer);
    }
    
    // 生成HTML内容
    const html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #4A90E2;">🔍 网络诊断报告</h3>
        <button onclick="document.getElementById('diagnostic-results').remove()" 
                style="background: #ff4444; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">
          关闭
        </button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <strong>📊 性能分析:</strong><br>
        • API调用时间: ${report.analysis.apiTime.toFixed(2)}ms<br>
        • 图片加载时间: ${report.analysis.imageTime.toFixed(2)}ms<br>
        • 总耗时: ${report.analysis.totalTime.toFixed(2)}ms<br>
        • 瓶颈: ${report.analysis.bottleneckDescription || '未检测到明显瓶颈'}
      </div>
      
      <div style="margin-bottom: 15px;">
        <strong>🎯 优化建议:</strong><br>
        ${report.recommendations.map(rec => `
          <div style="margin: 10px 0; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px;">
            <strong>${rec.title}:</strong><br>
            ${rec.suggestions.map(s => `• ${s}`).join('<br>')}
          </div>
        `).join('')}
      </div>
      
      <div>
        <strong>📝 详细日志:</strong><br>
        ${report.results.map(r => `
          <div style="margin: 5px 0; color: ${r.status === 'error' ? '#ff6b6b' : r.status === 'success' ? '#51cf66' : '#ffd43b'};">
            ${r.status === 'error' ? '❌' : r.status === 'success' ? '✅' : 'ℹ️'} ${r.message}
          </div>
        `).join('')}
      </div>
    `;
    
    resultContainer.innerHTML = html;
  }
}

// 全局诊断函数
window.runNetworkDiagnosis = async function() {
  const diagnostic = new NetworkDiagnostic();
  const report = await diagnostic.runFullDiagnosis();
  diagnostic.displayResults(report);
  return report;
};

// 添加快捷键支持 (Ctrl+D)
document.addEventListener('keydown', function(event) {
  if (event.ctrlKey && event.key === 'd') {
    event.preventDefault();
    window.runNetworkDiagnosis();
  }
});

console.log('🔧 网络诊断工具已加载');
console.log('💡 使用方法:');
console.log('  1. 在控制台运行: runNetworkDiagnosis()');
console.log('  2. 或按快捷键: Ctrl+D');