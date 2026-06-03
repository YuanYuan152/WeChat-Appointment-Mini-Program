// 配置测试文件
console.log('=== 配置测试 ===');

// 模拟环境变量
process.env.VITE_API_BASE_URL = 'http://localhost:1611';
process.env.NODE_ENV = 'development';

console.log('环境变量:');
console.log('VITE_API_BASE_URL:', process.env.VITE_API_BASE_URL);
console.log('NODE_ENV:', process.env.NODE_ENV);

// 模拟配置逻辑
const config = {
  development: {
    API_BASE_URL: 'http://localhost:1611',
    API_TIMEOUT: 10000
  },
  production: {
    API_BASE_URL: 'https://www.ji-psy.com',
    API_TIMEOUT: 10000
  }
};

const isDev = process.env.NODE_ENV === 'development';
const currentConfig = isDev ? config.development : config.production;

console.log('\n当前配置:');
console.log('环境:', isDev ? 'development' : 'production');
console.log('API_BASE_URL:', currentConfig.API_BASE_URL);
console.log('完整API地址:', `${currentConfig.API_BASE_URL}/api/frontend/GetHomeIndex`);

console.log('\n=== 测试完成 ===');
console.log('\n使用方法:');
console.log('1. 重启开发服务器: pnpm run dev:h5');
console.log('2. 检查控制台输出');
console.log('3. 验证网络请求是否包含 /api/frontend'); 