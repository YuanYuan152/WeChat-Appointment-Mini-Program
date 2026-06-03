import { defineConfig, presetUno, presetAttributify } from 'unocss'

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify()
  ],
  rules: [
    // 自定义规则
    [/^text-(.+)$/, ([, c]) => ({ color: c })],
    [/^bg-(.+)$/, ([, c]) => ({ 'background-color': c })]
  ],
  shortcuts: {
    // 布局快捷方式
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
    
    // 心理咨询平台 UI 规范 (治愈系、圆润、轻阴影)
    'page-container': 'min-h-screen bg-background p-4',
    
    // 按钮规范
    'btn-primary': 'bg-primary text-white px-6 py-2.5 rounded-full font-medium active:opacity-80 transition-opacity flex-center',
    'btn-outline': 'border border-primary text-primary px-6 py-2.5 rounded-full font-medium active:bg-primary-50 transition-colors flex-center',
    'btn-disabled': 'bg-gray-200 text-gray-400 px-6 py-2.5 rounded-full font-medium cursor-not-allowed flex-center',
    
    // 卡片规范 (大圆角、非常柔和的阴影)
    'card': 'bg-white rounded-2xl shadow-sm border border-gray-50 p-4',
    'card-hover': 'bg-white rounded-2xl shadow-md border border-gray-50 p-4 active:scale-95 transition-all',
    
    // 文本规范
    'text-title': 'text-gray-800 text-lg font-bold',
    'text-body': 'text-gray-600 text-base',
    'text-caption': 'text-gray-400 text-sm'
  },
  theme: {
    colors: {
      // 治愈系青绿色主色调 (Teal)
      primary: {
        DEFAULT: '#0D9488', // Teal 600 - 主色
        50: '#F0FDFA',
        100: '#CCFBF1',
        200: '#99F6E4',
        300: '#5EEAD4',
        400: '#2DD4BF',
        500: '#14B8A6',
        600: '#0D9488',
        700: '#0F766E',
        800: '#115E59',
        900: '#134E4A',
      },
      secondary: '#64748B', // Slate 500 - 次要文本/图标
      success: '#10B981',   // 绿色 - 成功/完成
      warning: '#F59E0B',   // 橙色 - 提醒/进行中
      error: '#EF4444',     // 红色 - 错误/高风险
      surface: '#FFFFFF',   // 表面色 (卡片)
      background: '#F9FAFB' // 暖灰背景色
    }
  }
})