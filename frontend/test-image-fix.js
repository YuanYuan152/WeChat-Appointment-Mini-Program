// 图片URL修复测试
console.log('=== 图片URL修复测试 ===');

// 模拟配置
const CURRENT_CONFIG = {
  API_BASE_URL: 'http://localhost:1611'
};

// 模拟图片URL修复函数
const fixImageUrl = (imagePath) => {
  if (!imagePath) {
    return '/static/images/default-placeholder.png';
  }

  // 如果已经是完整的URL，直接返回
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // 如果是以 / 开头的绝对路径，添加正确的域名
  if (imagePath.startsWith('/')) {
    return `${CURRENT_CONFIG.API_BASE_URL}${imagePath}`;
  }

  // 如果是相对路径，添加正确的域名和路径
  return `${CURRENT_CONFIG.API_BASE_URL}/${imagePath}`;
};

// 测试数据
const testData = {
  banners: [
    { id: 1, image: '/Public/images/20210131150000.jpg' },
    { id: 2, image: '/Public/images/20210131150001.jpg' }
  ],
  doctors: [
    { id: 1, avatar: '/Public/images/doctor1.jpg' },
    { id: 2, url: '/Public/images/doctor2.jpg' }
  ]
};

console.log('原始数据:');
console.log('banners:', testData.banners);
console.log('doctors:', testData.doctors);

// 修复图片URL
const fixArrayImageUrls = (items, imageFields) => {
  return items.map(item => {
    const newItem = { ...item };
    imageFields.forEach(field => {
      if (newItem[field] && typeof newItem[field] === 'string') {
        newItem[field] = fixImageUrl(newItem[field]);
      }
    });
    return newItem;
  });
};

// 应用修复
const fixedBanners = fixArrayImageUrls(testData.banners, ['image']);
const fixedDoctors = fixArrayImageUrls(testData.doctors, ['avatar', 'url']);

console.log('\n修复后的数据:');
console.log('banners:', fixedBanners);
console.log('doctors:', fixedDoctors);

console.log('\n=== 测试完成 ===');
console.log('\n现在图片URL应该包含正确的域名和端口:');
console.log('✅ /Public/images/20210131150000.jpg -> http://localhost:1611/Public/images/20210131150000.jpg');
console.log('✅ /Public/images/doctor1.jpg -> http://localhost:1611/Public/images/doctor1.jpg'); 