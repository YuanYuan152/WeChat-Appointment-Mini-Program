// 简单配置文件 - 只需要修改API_BASE_URL即可

// 直接使用环境变量，如果没有则使用默认值
export const CURRENT_CONFIG = {
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://www.ji-psy.com',
  API_TIMEOUT: parseInt(import.meta.env.VITE_API_TIMEOUT || '15000'),
  APP_TITLE: import.meta.env.VITE_APP_TITLE || '连心心理',
  APP_VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0'
};

// 显示当前配置信息
console.log('🔧 当前配置:', CURRENT_CONFIG); 