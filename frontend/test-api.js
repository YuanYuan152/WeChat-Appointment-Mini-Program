// API测试脚本
// 用于测试后端接口连接

const API_BASE_URL = 'http://localhost:1611';

// 测试函数
async function testApi(endpoint, description) {
  try {
    console.log(`\n🧪 测试 ${description}...`);
    const startTime = Date.now();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} 成功!`);
      console.log(`⏱️  响应时间: ${responseTime}ms`);
      console.log(`📊 响应数据:`, JSON.stringify(data, null, 2));
      return true;
    } else {
      console.log(`❌ ${description} 失败!`);
      console.log(`📊 状态码: ${response.status}`);
      console.log(`📊 状态文本: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    console.log(`💥 ${description} 异常!`);
    console.log(`📊 错误信息: ${error.message}`);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('🚀 开始API接口测试...');
  console.log(`🌐 后端地址: ${API_BASE_URL}`);
  console.log('=' .repeat(50));
  
  const tests = [
    { endpoint: '/api/test', description: 'API Test接口' },
    { endpoint: '/api/health', description: '健康检查接口' },
    { endpoint: '/api/home/index', description: '首页数据接口' },
    { endpoint: '/api/search?keyword=测试', description: '搜索接口' }
  ];
  
  let successCount = 0;
  let totalCount = tests.length;
  
  for (const test of tests) {
    const success = await testApi(test.endpoint, test.description);
    if (success) successCount++;
    
    // 等待一下再测试下一个接口
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('📊 测试结果汇总:');
  console.log(`✅ 成功: ${successCount}/${totalCount}`);
  console.log(`❌ 失败: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log('🎉 所有接口测试通过！');
  } else {
    console.log('⚠️  部分接口测试失败，请检查后端服务状态。');
  }
}

// 运行测试
if (typeof window !== 'undefined') {
  // 浏览器环境
  console.log('🌐 在浏览器中运行API测试...');
  runTests().catch(console.error);
} else {
  // Node.js环境
  console.log('🖥️  在Node.js中运行API测试...');
  runTests().catch(console.error);
}

// 导出测试函数（用于模块化）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testApi, runTests };
} 