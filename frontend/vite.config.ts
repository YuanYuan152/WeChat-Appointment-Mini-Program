import { defineConfig, loadEnv } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'

export default defineConfig(({ command, mode }) => {
  // 加载环境变量，包括env.local文件
  const env = loadEnv(mode, process.cwd(), '')
  
  // 确保环境变量正确加载
  if (!env.VITE_API_BASE_URL) {
    console.warn('⚠️ 环境变量VITE_API_BASE_URL未设置，使用默认值')
  }
  
  // 直接使用环境变量中的API地址
  const apiBaseUrl = env.VITE_API_BASE_URL || 'https://www.ji-psy.com'
  
  console.log(`🚀 Vite 配置加载完成:`)
  console.log(`   模式: ${mode}`)
  console.log(`   API地址: ${apiBaseUrl}`)
  console.log(`   命令: ${command}`)
  
  return {
    plugins: [
      uni()
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // 代理所有API请求
        '^/api/.*': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              if (req.url) {
                console.log(`🔄 代理请求: ${req.method} ${req.url} -> ${apiBaseUrl}${req.url}`);
              }
            });
            proxy.on('error', (err, req, res) => {
              console.error('代理错误:', err);
            });
          }
        }
      }
    },
    build: {
      outDir: '../lxxl/static/frontend',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['vue', 'pinia'],
            uni: ['@dcloudio/uni-app']
          }
        }
      }
    },
    // 定义环境变量
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      __APP_TITLE__: JSON.stringify(env.VITE_APP_TITLE || '连心心理')
    }
  }
}) 