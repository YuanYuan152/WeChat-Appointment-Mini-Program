# 连心心理 - 生产环境部署指南

## 概述
本文档说明如何将连心心理前端应用部署到生产环境，使用 `https://www.ji-psy.com` 作为API接口地址。

## 环境配置

### 生产环境变量
```bash
# 生产环境配置
VITE_API_BASE_URL=https://www.ji-psy.com
VITE_API_TIMEOUT=15000
VITE_APP_TITLE=连心心理
VITE_APP_VERSION=1.0.0
NODE_ENV=production
```

## 构建步骤

### 方法1: 使用批处理脚本 (Windows)
```bash
# 双击运行
build-prod.bat
```

### 方法2: 使用Shell脚本 (Linux/Mac)
```bash
# 添加执行权限
chmod +x build-prod.sh

# 运行构建脚本
./build-prod.sh
```

### 方法3: 手动构建
```bash
# 清理之前的构建文件
pnpm run clean

# 安装依赖
pnpm install

# 构建生产版本
pnpm run build:prod
```

## 构建输出

构建完成后，文件将输出到以下目录：
- **主要输出**: `dist/`
- **备用输出**: `../lxxl/static/frontend/`

## 部署配置

### 1. 静态文件部署
将 `dist/` 目录下的所有文件部署到Web服务器。

### 2. Nginx配置示例
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API代理配置
    location /api/ {
        proxy_pass https://www.ji-psy.com;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Apache配置示例
```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot /path/to/dist
    
    <Directory /path/to/dist>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # 启用重写模块
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^(.*)$ /index.html [L]
</VirtualHost>
```

## 验证部署

### 1. 检查API连接
访问应用后，在浏览器控制台查看：
```javascript
console.log('API地址:', import.meta.env.VITE_API_BASE_URL);
console.log('环境:', import.meta.env.MODE);
```

### 2. 测试API接口
确保以下接口可以正常访问：
- `https://www.ji-psy.com/api/frontend/GetHomeIndex`
- `https://www.ji-psy.com/api/frontend/GetBanners`
- `https://www.ji-psy.com/api/frontend/GetDoctorList`

## 注意事项

1. **HTTPS**: 生产环境必须使用HTTPS协议
2. **CORS**: 确保API服务器允许跨域请求
3. **缓存**: 配置适当的缓存策略
4. **监控**: 部署后监控应用性能和错误日志

## 故障排除

### 常见问题

1. **API请求失败**
   - 检查网络连接
   - 验证API地址是否正确
   - 检查CORS配置

2. **构建失败**
   - 清理缓存: `pnpm run clean`
   - 重新安装依赖: `pnpm install`
   - 检查Node.js版本 (需要 >= 18.0.0)

3. **部署后页面空白**
   - 检查路由配置
   - 验证静态文件路径
   - 检查服务器配置

## 联系支持

如有问题，请联系连心心理技术团队。 