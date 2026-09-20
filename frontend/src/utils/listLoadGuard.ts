/** 页面独立兜底：超时后失效旧请求，避免重试被迟到响应覆盖。 */
export function createListLoadGuard(onTimeout: () => void, timeoutMs = 20000) {
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const clear = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
  }
  return {
    start() {
      clear()
      const id = ++generation
      timer = setTimeout(() => {
        if (id !== generation) return
        timer = undefined
        generation++
        onTimeout()
      }, timeoutMs)
      return id
    },
    isCurrent(id: number) { return id === generation },
    finish(id: number) {
      if (id !== generation) return false
      clear()
      return true
    },
    dispose() { clear(); generation++ },
  }
}
