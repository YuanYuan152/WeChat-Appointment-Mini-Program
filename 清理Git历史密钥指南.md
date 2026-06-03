# 清理 Git 历史中的密钥

## 问题
GitHub Push Protection 检测到历史提交中包含阿里云密钥，拒绝 push。

## 解决方案：使用 BFG Repo-Cleaner

### 步骤 1：安装 BFG Repo-Cleaner

**Windows (使用 Scoop)**：
```powershell
scoop install bfg
```

**或手动下载**：
- 下载 [bfg.jar](https://rtyley.github.io/bfg-repo-cleaner/)
- 需要 Java 环境

### 步骤 2：备份仓库
```bash
cd D:\data\extra
cp -r lxxl-main lxxl-main-backup
```

### 步骤 3：创建密钥替换文件

创建 `secrets.txt`，每行一个要清理的密钥（替换为你的真实密钥）：
```
LTAI5t******************    # 阿里云 AccessKey ID
59NEBi******************    # 阿里云 AccessKey Secret
wx7c7c****************      # 微信 AppID
0c72c9****************      # 微信 AppSecret
wx605b****************      # 微信 AppID2
7c15f1****************      # 微信 AppSecret2
```

### 步骤 4：运行 BFG 清理
```bash
cd D:\data\extra\lxxl-main

# 如果用 scoop 安装
bfg --replace-text secrets.txt

# 如果用 jar 文件
java -jar bfg.jar --replace-text secrets.txt
```

### 步骤 5：清理 reflog 并强制推送
```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin main --force
```

### 步骤 6：重新生成所有密钥

⚠️ **清理历史后，这些密钥已经暴露，必须重新生成**：
1. 阿里云控制台 → 删除旧 AccessKey → 创建新的
2. 微信公众平台 → 重置 AppSecret
3. 更新本地 `Web.config` 中的新密钥

---

## 方案 2：使用 GitHub Secret Allow（快速但不安全）

GitHub 提供了"允许此密钥"的链接，但这**不推荐**，因为：
- 密钥已经在公开仓库历史中暴露
- 任何人都能从历史记录中提取

如果只是临时测试仓库，可以点击 GitHub 提供的链接允许推送。

---

## 推荐流程

1. **立即重新生成密钥**（防止被滥用）
2. **清理 Git 历史**（方案 1）
3. **更新本地配置文件**（使用新密钥）

## 完成后验证

```bash
# 确认历史中无密钥
git log --all --full-history --source -- "**/AliMsg.cs" "**/Common.cs" "**/Web.config"

# 搜索是否还有密钥残留（替换为你的真实密钥前几位）
git grep "LTAI5t" $(git rev-list --all)
```

如果输出为空，说明清理成功。
