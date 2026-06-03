# 👨‍⚕️ 咨询师API接口说明

## 📋 接口概述

新增了获取咨询师列表的API接口，支持多种筛选条件和分页功能。

## 🌐 接口详情

### GET /api/api/GetDoctorList

**描述**: 获取咨询师列表，支持筛选和分页

**请求参数**:
- `keyword` (string, 可选): 搜索关键词，支持姓名、专业、省份模糊搜索
- `province` (string, 可选): 省份筛选
- `specialty` (string, 可选): 专业领域筛选
- `page` (int, 可选): 页码，默认1
- `pageSize` (int, 可选): 每页数量，默认10

**请求示例**:
```
GET /api/api/GetDoctorList
GET /api/api/GetDoctorList?keyword=张&page=1&pageSize=5
GET /api/api/GetDoctorList?province=北京&specialty=焦虑症
```

**响应格式**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "gId": "doc001",
        "name": "张医生",
        "UserName": "doctor001",
        "tel": "13800138000",
        "email": "doctor@example.com",
        "hospitalName": "北京心理医院",
        "departmentName": "心理咨询科",
        "position": "主任医师",
        "sex": "男",
        "age": 45,
        "Profile": "资深心理咨询师",
        "introduce": "从事心理咨询工作20年...",
        "topUrl": "/static/images/avatar1.jpg",
        "url": "/static/images/doctor1.jpg",
        "Specialty": "焦虑症、抑郁症、婚姻咨询",
        "Careerexperience": "20年心理咨询经验",
        "Billing": 300.0,
        "FaceBilling": 400.0,
        "ConsultHours": 5000,
        "WorkYears": 20,
        "Province": "北京",
        "City": "北京市",
        "Field": "心理咨询",
        "TargetGroup": "成人、青少年",
        "Mode": "面诊、视频咨询",
        "number": 1,
        "IsTop": false,
        "IsShow": true,
        "createTime": "2024-01-15T10:30:00",
        "ModifyTime": "2024-01-15T10:30:00"
      }
    ],
    "total": 100,
    "page": 1,
    "pageSize": 10,
    "totalPages": 10
  }
}
```

## 🔧 后端实现

### 数据获取
```csharp
// 调用后台数据助手获取咨询师列表
var doctorList = dataHelper.GetDoctorLst();
```

### 筛选逻辑
```csharp
// 关键词筛选
if (!string.IsNullOrEmpty(keyword))
{
    filteredList = filteredList.Where(d => 
        d.name.Contains(keyword) || 
        d.Specialty.Contains(keyword) ||
        d.Province.Contains(keyword)
    );
}

// 省份筛选
if (!string.IsNullOrEmpty(province))
{
    filteredList = filteredList.Where(d => d.Province == province);
}

// 专业筛选
if (!string.IsNullOrEmpty(specialty))
{
    filteredList = filteredList.Where(d => d.Specialty.Contains(specialty));
}
```

### 分页处理
```csharp
// 计算总数
var totalCount = filteredList.Count();

// 分页处理
var pagedList = filteredList
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToList();

// 计算总页数
var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);
```

## 📱 前端使用

### 1. API调用
```typescript
import { doctorApi } from '@/apis'

// 获取所有咨询师
const getAllDoctors = async () => {
  const result = await doctorApi.getList()
  if (result.code === 0) {
    console.log('咨询师列表:', result.data.list)
    console.log('总数:', result.data.total)
  }
}

// 搜索咨询师
const searchDoctors = async (keyword: string) => {
  const result = await doctorApi.getList({ keyword })
  if (result.code === 0) {
    console.log('搜索结果:', result.data.list)
  }
}

// 分页获取
const getDoctorsByPage = async (page: number, pageSize: number) => {
  const result = await doctorApi.getList({ page, pageSize })
  if (result.code === 0) {
    console.log('当前页:', result.data.page)
    console.log('总页数:', result.data.totalPages)
  }
}
```

### 2. 筛选示例
```typescript
// 按省份和专业筛选
const getFilteredDoctors = async () => {
  const result = await doctorApi.getList({
    province: '北京',
    specialty: '焦虑症',
    page: 1,
    pageSize: 20
  })
  
  if (result.code === 0) {
    const { list, total, page, pageSize, totalPages } = result.data
    console.log(`找到 ${total} 位咨询师，当前第 ${page}/${totalPages} 页`)
  }
}
```

## 🧪 测试方法

### 1. 使用测试页面
打开 `frontend/test-simple.html`，测试以下接口：
- 基础列表: `/GetDoctorList`
- 筛选搜索: `/GetDoctorList?keyword=张&page=1&pageSize=5`

### 2. 直接API调用
```bash
# 获取所有咨询师
curl "http://localhost:1611/api/api/GetDoctorList"

# 搜索姓张的咨询师
curl "http://localhost:1611/api/api/GetDoctorList?keyword=张"

# 筛选北京的咨询师
curl "http://localhost:1611/api/api/GetDoctorList?province=北京"

# 分页获取
curl "http://localhost:1611/api/api/GetDoctorList?page=1&pageSize=5"
```

### 3. 浏览器测试
```
http://localhost:1611/api/api/GetDoctorList
http://localhost:1611/api/api/GetDoctorList?keyword=张
http://localhost:1611/api/api/GetDoctorList?province=北京&page=1&pageSize=10
```

## ⚠️ 注意事项

### 1. 数据源
- 接口直接调用 `dataHelper.GetDoctorLst()`
- 数据来自数据库，支持缓存机制
- 筛选和分页在前端处理

### 2. 性能考虑
- 大量数据时建议使用分页
- 复杂筛选条件可能影响性能
- 考虑添加数据缓存

### 3. 错误处理
- 接口包含完整的错误处理
- 返回统一的错误格式
- 支持异常信息记录

## 🔮 扩展功能

### 1. 高级筛选
- 按职称筛选
- 按咨询费用范围筛选
- 按从业年限筛选
- 按咨询方式筛选

### 2. 排序功能
- 按姓名排序
- 按咨询费用排序
- 按从业年限排序
- 按评分排序

### 3. 数据统计
- 咨询师总数统计
- 按省份分布统计
- 按专业领域统计
- 按职称分布统计

## 📞 技术支持

如果遇到问题：
1. 检查后端服务是否正常运行
2. 确认 `dataHelper.GetDoctorLst()` 方法可用
3. 验证数据库连接和数据完整性
4. 使用测试页面诊断接口问题

现在咨询师列表API接口已经完全实现，可以开始测试了！🚀 