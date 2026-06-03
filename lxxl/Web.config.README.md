# Web.config 配置说明

## 首次配置步骤

1. 复制示例配置文件：
   ```bash
   cp Web.config.example Web.config
   ```

2. 编辑 `Web.config`，填入真实的配置值：

### 必须配置的敏感信息

#### 微信公众号/小程序配置
```xml
<add key="AppID" value="你的微信AppID" />
<add key="AppSecret" value="你的微信AppSecret" />
<add key="AppID2" value="你的第二个微信AppID（如有）" />
<add key="AppSecret2" value="你的第二个微信AppSecret（如有）" />
```

#### 阿里云短信配置
```xml
<add key="AliyunSmsAccessKeyId" value="你的阿里云AccessKeyId" />
<add key="AliyunSmsAccessKeySecret" value="你的阿里云AccessKeySecret" />
<add key="AliyunSmsSignName" value="你的短信签名名称" />
```

#### 数据库连接字符串
```xml
<add name="TMLSContext" connectionString="server=你的服务器;database=数据库名;Integrated Security=True;MultipleActiveResultSets=true;" providerName="System.Data.SqlClient"/>
```

## 安全说明

- ⚠️ **`Web.config` 包含敏感信息，已加入 `.gitignore`，不会提交到 Git**
- ✅ `Web.config.example` 是模板文件，可以安全提交
- ✅ 所有敏感配置已从代码中移除，改为从配置文件读取

## 相关代码修改

以下文件已修改为从配置读取：

1. **lxxl/Service/AliMsg.cs**（第 18-19 行）
   - 旧代码：硬编码 `accessId` 和 `accessSecret`
   - 新代码：`System.Configuration.ConfigurationManager.AppSettings["AliyunSmsAccessKeyId"]`

2. **lxxl/Service/Common.cs**（第 31-32 行）
   - 旧代码：硬编码 `accessKeyId` 和 `accessKeySecret`
   - 新代码：从 `AppSettings` 读取

## 常见问题

### Q: 启动项目报错 "配置项未找到"
A: 确保 `Web.config` 文件存在，且包含所有必需的配置项（参考 `Web.config.example`）

### Q: 如何获取阿里云短信配置？
A: 登录[阿里云控制台](https://dysms.console.aliyun.com/) → 访问控制 → 用户 → 创建 AccessKey

### Q: 如何获取微信配置？
A: 登录[微信公众平台](https://mp.weixin.qq.com/) → 开发 → 基本配置

## 多环境配置建议

如果需要区分开发/测试/生产环境，可以：

1. 创建 `Web.config.development`、`Web.config.production`
2. 在发布时通过 Web.config 转换功能替换配置
3. 或使用环境变量管理敏感配置
