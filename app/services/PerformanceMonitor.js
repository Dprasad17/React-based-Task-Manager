import { NativeModules, NativeEventEmitter } from 'react-native';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      fps: 0,
      memoryUsage: 0,
      renderTime: 0,
      droppedFrames: 0,
    };
    this.listeners = [];
    this.isMonitoring = false;
    this.frameCount = 0;
    this.lastFrameTime = 0;
    this.droppedFrames = 0;
  }

  // Start monitoring performance metrics
  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.startFPSMonitoring();
    this.startMemoryMonitoring();
    this.startRenderTimeMonitoring();
    
    console.log('Performance monitoring started');
  }

  // Stop monitoring
  stopMonitoring() {
    this.isMonitoring = false;
    this.listeners.forEach(listener => listener.remove());
    this.listeners = [];
    
    console.log('Performance monitoring stopped');
  }

  // Monitor FPS (Frames Per Second)
  startFPSMonitoring() {
    const measureFPS = () => {
      if (!this.isMonitoring) return;

      const now = Date.now();
      if (this.lastFrameTime > 0) {
        const deltaTime = now - this.lastFrameTime;
        const fps = 1000 / deltaTime;
        
        this.metrics.fps = Math.round(fps);
        
        // Track dropped frames (FPS < 30 is considered dropped)
        if (fps < 30) {
          this.droppedFrames++;
        }
        
        this.metrics.droppedFrames = this.droppedFrames;
      }
      
      this.lastFrameTime = now;
      this.frameCount++;
      
      // Reset counters every 60 frames
      if (this.frameCount >= 60) {
        this.frameCount = 0;
        this.droppedFrames = 0;
      }
      
      requestAnimationFrame(measureFPS);
    };
    
    requestAnimationFrame(measureFPS);
  }

  // Monitor memory usage
  startMemoryMonitoring() {
    const measureMemory = () => {
      if (!this.isMonitoring) return;

      try {
        // Get memory usage (this is a simplified version)
        const memoryInfo = global.performance?.memory || {};
        this.metrics.memoryUsage = memoryInfo.usedJSHeapSize || 0;
      } catch (error) {
        console.warn('Could not measure memory usage:', error);
      }
      
      setTimeout(measureMemory, 1000); // Check every second
    };
    
    measureMemory();
  }

  // Monitor render time
  startRenderTimeMonitoring() {
    const measureRenderTime = () => {
      if (!this.isMonitoring) return;

      const startTime = performance.now();
      
      requestAnimationFrame(() => {
        const endTime = performance.now();
        this.metrics.renderTime = endTime - startTime;
      });
      
      setTimeout(measureRenderTime, 100); // Check every 100ms
    };
    
    measureRenderTime();
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: Date.now(),
    };
  }

  // Get performance score (0-100)
  getPerformanceScore() {
    const { fps, memoryUsage, renderTime, droppedFrames } = this.metrics;
    
    let score = 100;
    
    // FPS scoring (60 FPS = 100, 30 FPS = 50, <30 FPS = 0)
    if (fps >= 60) score -= 0;
    else if (fps >= 45) score -= 10;
    else if (fps >= 30) score -= 30;
    else score -= 50;
    
    // Memory usage scoring (simplified)
    if (memoryUsage > 100 * 1024 * 1024) score -= 20; // >100MB
    else if (memoryUsage > 50 * 1024 * 1024) score -= 10; // >50MB
    
    // Render time scoring
    if (renderTime > 16.67) score -= 20; // >16.67ms (60fps threshold)
    else if (renderTime > 8.33) score -= 10; // >8.33ms (120fps threshold)
    
    // Dropped frames scoring
    if (droppedFrames > 10) score -= 30;
    else if (droppedFrames > 5) score -= 15;
    
    return Math.max(0, Math.min(100, score));
  }

  // Log performance metrics
  logMetrics() {
    const metrics = this.getMetrics();
    const score = this.getPerformanceScore();
    
    console.log('Performance Metrics:', {
      ...metrics,
      performanceScore: score,
      status: this.getPerformanceStatus(score),
    });
  }

  // Get performance status
  getPerformanceStatus(score) {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    if (score >= 30) return 'Poor';
    return 'Critical';
  }

  // Monitor specific component render time
  measureComponentRender(componentName, renderFunction) {
    const startTime = performance.now();
    const result = renderFunction();
    const endTime = performance.now();
    
    const renderTime = endTime - startTime;
    
    console.log(`Component ${componentName} render time: ${renderTime.toFixed(2)}ms`);
    
    return result;
  }

  // Monitor API call performance
  measureAPICall(apiCall) {
    const startTime = performance.now();
    
    return apiCall().then(result => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`API call duration: ${duration.toFixed(2)}ms`);
      
      return result;
    }).catch(error => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`API call failed after ${duration.toFixed(2)}ms:`, error);
      throw error;
    });
  }

  // Get performance recommendations
  getRecommendations() {
    const { fps, memoryUsage, renderTime, droppedFrames } = this.metrics;
    const recommendations = [];
    
    if (fps < 30) {
      recommendations.push('Consider reducing animation complexity or using native driver');
    }
    
    if (memoryUsage > 100 * 1024 * 1024) {
      recommendations.push('Memory usage is high. Consider implementing image optimization');
    }
    
    if (renderTime > 16.67) {
      recommendations.push('Render time is high. Consider using React.memo or useMemo');
    }
    
    if (droppedFrames > 10) {
      recommendations.push('Many dropped frames detected. Check for expensive operations in render');
    }
    
    return recommendations;
  }

  // Export performance data
  exportPerformanceData() {
    const data = {
      metrics: this.getMetrics(),
      score: this.getPerformanceScore(),
      status: this.getPerformanceStatus(this.getPerformanceScore()),
      recommendations: this.getRecommendations(),
      timestamp: new Date().toISOString(),
    };
    
    return JSON.stringify(data, null, 2);
  }
}

export default new PerformanceMonitor();









