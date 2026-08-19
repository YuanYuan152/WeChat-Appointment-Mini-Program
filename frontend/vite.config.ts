import { defineConfig, loadEnv, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

/**
 * 确保 mp-weixin 的 app.js 末尾有 createApp().app.mount("#app")。
 * 微信端 mount 会被劫持成注册原生 App 并设置 $vm；缺失会导致 getApp().$vm undefined。
 */
function ensureMpWeixinAppMount(): Plugin {
  const ensure = (code: string) => {
    if (/createApp\(\)\.app\.mount\(["']#app["']\)/.test(code)) return code
    if (!/function createApp\(/.test(code) && !/exports\.createApp\s*=/.test(code)) return code
    if (/exports\.createApp\s*=\s*createApp\s*;?/.test(code)) {
      return code.replace(
        /exports\.createApp\s*=\s*createApp\s*;?/,
        'createApp().app.mount("#app");\nexports.createApp = createApp;',
      )
    }
    return `${code}\ncreateApp().app.mount("#app");\n`
  }

  return {
    name: 'ensure-mp-weixin-app-mount',
    enforce: 'post',
    generateBundle(_options, bundle) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue
        if (item.fileName !== 'app.js' && !item.fileName.endsWith('/app.js')) continue
        item.code = ensure(item.code)
      }
    },
    writeBundle(outputOptions) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return
      const outDir = outputOptions.dir
      if (!outDir) return
      const full = path.join(outDir, 'app.js')
      if (!fs.existsSync(full)) return
      const before = fs.readFileSync(full, 'utf8')
      const after = ensure(before)
      if (after !== before) fs.writeFileSync(full, after, 'utf8')
    },
  }
}

/**
 * 真机（尤其 iOS）上 Vue 开发态 createDevRenderContext 会在 ctx 上挂 `$` getter，
 * 与 Proxy 叠加后访问 .$ 无限递归 → Maximum call stack size exceeded → App 挂不上。
 */
function patchMpWeixinVueDollarRecursion(): Plugin {
  const patchVueSource = (code: string) => {
    let next = code
    // 1) 强制使用生产态 ctx，避免 createDevRenderContext 的 $ getter
    next = next.replace(
      /instance\.ctx\s*=\s*createDevRenderContext\(instance\)\s*;/g,
      'instance.ctx = { _: instance }; /* mp-weixin: avoid $ recursion */',
    )
    // 2) Proxy get 对 "$" 短路（幂等：已有则不再插入）
    if (!/get\(\{\s*_\s*:\s*instance\s*\},\s*key\)\s*\{\s*\n\s*if \(key === "\$"\) return instance;/.test(next)) {
      next = next.replace(
        /get\(\{\s*_\s*:\s*instance\s*\},\s*key\)\s*\{/g,
        'get({ _: instance }, key) {\n    if (key === "$") return instance;',
      )
    }
    // 去掉误重复插入的短路语句
    next = next.replace(
      /(if \(key === "\$"\) return instance;\s*){2,}/g,
      'if (key === "$") return instance;\n    ',
    )
    // 3) createDevRenderContext 里跳过对 "$" 的 defineProperty（兜底，幂等）
    if (!/Object\.keys\(publicPropertiesMap\)\.forEach\(\(key\)\s*=>\s*\{\s*\n\s*if \(key === "\$"\) return;/.test(next)) {
      next = next.replace(
        /Object\.keys\(publicPropertiesMap\)\.forEach\(\(key\)\s*=>\s*\{/g,
        'Object.keys(publicPropertiesMap).forEach((key) => {\n    if (key === "$") return;',
      )
    }
    next = next.replace(
      /(if \(key === "\$"\) return;\s*){2,}/g,
      'if (key === "$") return;\n    ',
    )
    if (next.includes('setDevtoolsHook')) {
      next = next.replace(
        /setDevtoolsHook\s*\([^)]*\)\s*;/g,
        '/* setDevtoolsHook skipped on mp-weixin */;',
      )
    }
    return next
  }

  return {
    name: 'patch-mp-weixin-vue-dollar-recursion',
    enforce: 'pre',
    transform(code, id) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return
      if (/[\\/]pinia[\\/]/.test(id) || id.includes('pinia.mjs')) {
        const next = code.replace(
          /const IS_CLIENT\s*=\s*typeof window\s*!==\s*["']undefined["']/g,
          'const IS_CLIENT = false /* mp-weixin */',
        )
        if (next !== code) return { code: next, map: null }
        return
      }
      const isVueRuntime =
        id.includes('@dcloudio/uni-mp-vue') ||
        id.includes(`${path.sep}uni-mp-vue${path.sep}`) ||
        id.includes('vue.runtime')
      if (!isVueRuntime) return
      if (!code.includes('createDevRenderContext') && !code.includes('publicPropertiesMap')) return
      const next = patchVueSource(code)
      if (next === code) return
      return { code: next, map: null }
    },
    generateBundle(_options, bundle) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return
      for (const item of Object.values(bundle)) {
        if (item.type !== 'chunk') continue
        if (!String(item.fileName).replace(/\\/g, '/').endsWith('common/vendor.js')) continue
        item.code = patchVueSource(item.code)
      }
    },
    writeBundle(outputOptions) {
      if (process.env.UNI_PLATFORM !== 'mp-weixin') return
      const outDir = outputOptions.dir
      if (!outDir) return
      const full = path.join(outDir, 'common', 'vendor.js')
      if (!fs.existsSync(full)) return
      const before = fs.readFileSync(full, 'utf8')
      const after = patchVueSource(before)
      if (after !== before) fs.writeFileSync(full, after, 'utf8')
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isMpWeixin = process.env.UNI_PLATFORM === 'mp-weixin'

  if (!env.VITE_API_BASE_URL) {
    console.warn('⚠️ 环境变量VITE_API_BASE_URL未设置，使用默认值')
  }

  const apiBaseUrl = env.VITE_API_BASE_URL || 'https://www.ji-psy.com'

  console.log(`🚀 Vite 配置加载完成:`)
  console.log(`   模式: ${mode}`)
  console.log(`   平台: ${process.env.UNI_PLATFORM || 'unknown'}`)
  console.log(`   API地址: ${apiBaseUrl}`)
  console.log(`   V2地址: ${env.VITE_API_V2_BASE_URL || '(default)'}`)
  console.log(`   模拟登录: ${env.VITE_ENABLE_MOCK_LOGIN === 'true' ? '开' : '关'}`)
  console.log(`   命令: ${command}`)

  return {
    plugins: [uni(), patchMpWeixinVueDollarRecursion(), ensureMpWeixinAppMount()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        '^/api/.*': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      ...(isMpWeixin
        ? {}
        : {
            outDir: '../lxxl/static/frontend',
            emptyOutDir: true,
            rollupOptions: {
              output: {
                manualChunks: {
                  vendor: ['vue', 'pinia'],
                  uni: ['@dcloudio/uni-app'],
                },
              },
            },
          }),
    },
    define: {
      __APP_VERSION__: JSON.stringify(env.VITE_APP_VERSION || '1.0.0'),
      __APP_TITLE__: JSON.stringify(env.VITE_APP_TITLE || '连心心理'),
      ...(isMpWeixin ? { __VUE_PROD_DEVTOOLS__: 'false' } : {}),
    },
  }
})
