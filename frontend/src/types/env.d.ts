// 环境变量类型声明
declare global {
  const uni: any
  const wx: any
  const plus: any
  const weex: any
  const getCurrentPages: () => any[]
  const getApp: () => any
}

// 模块声明
declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.png'
declare module '*.jpg'
declare module '*.jpeg'
declare module '*.gif'
declare module '*.svg'
declare module '*.webp'

export {} 