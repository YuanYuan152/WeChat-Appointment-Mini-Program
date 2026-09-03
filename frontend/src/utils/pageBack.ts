const TAB_SLOT_ROUTES = new Set(['pages/tab-slot/index', 'pages/workbench/index'])

/** 无上一页时跳转到指定 Tab（如分享链接直开详情页） */
export function navigateBackOrSwitchTab(tabUrl = '/pages/index/index'): void {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    const prevRoute = pages[pages.length - 2]?.route || ''
    if (TAB_SLOT_ROUTES.has(prevRoute)) {
      uni.switchTab({ url: tabUrl })
      return
    }
    uni.navigateBack()
    return
  }
  uni.switchTab({ url: tabUrl })
}

/** 工作台等页面：优先返回上一页；从 Tab 工作台入口进入则回首页 Tab */
export function navigateBackOrHome(): void {
  navigateBackOrSwitchTab('/pages/index/index')
}
