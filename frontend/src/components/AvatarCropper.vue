<template>
  <view v-if="visible" class="crop-overlay" @touchmove.stop.prevent>
    <text class="crop-title">拖动调整位置，双指缩放</text>
    <view
      class="crop-stage"
      :style="stageStyle"
      @touchstart="onTouchStart"
      @touchmove.stop.prevent="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <image
        v-if="src"
        class="crop-img"
        :src="src"
        mode="scaleToFill"
        :style="imageStyle"
      />
      <view class="crop-mask" />
    </view>
    <text class="crop-hint">圆形内为最终头像效果</text>
    <view class="crop-btns">
      <button class="crop-btn cancel" @tap="emit('cancel')">取消</button>
      <button class="crop-btn confirm" :loading="confirming" @tap="confirm">确定</button>
    </view>
    <canvas
      type="2d"
      id="avatarCropCanvas"
      class="hidden-canvas"
      :style="{ width: outputSize + 'px', height: outputSize + 'px' }"
    />
  </view>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    visible: boolean
    src: string
    outputSize?: number
  }>(),
  {
    outputSize: 400,
  },
)

const cropSize = ref(280)

const emit = defineEmits<{
  cancel: []
  confirm: [filePath: string]
}>()

const instance = getCurrentInstance()
const naturalW = ref(1)
const naturalH = ref(1)
const imgLeft = ref(0)
const imgTop = ref(0)
const zoom = ref(1)
const confirming = ref(false)

const coverScale = computed(() => {
  const size = cropSize.value
  return Math.max(size / naturalW.value, size / naturalH.value)
})

const imgW = computed(() => naturalW.value * coverScale.value * zoom.value)
const imgH = computed(() => naturalH.value * coverScale.value * zoom.value)

const stageStyle = computed(() => ({
  width: `${cropSize.value}px`,
  height: `${cropSize.value}px`,
}))

const imageStyle = computed(() => ({
  width: `${imgW.value}px`,
  height: `${imgH.value}px`,
  left: `${imgLeft.value}px`,
  top: `${imgTop.value}px`,
}))

const clampPosition = () => {
  const size = cropSize.value
  const minLeft = size - imgW.value
  const minTop = size - imgH.value
  imgLeft.value = Math.min(0, Math.max(minLeft, imgLeft.value))
  imgTop.value = Math.min(0, Math.max(minTop, imgTop.value))
}

const resetLayout = () => {
  const sys = uni.getSystemInfoSync()
  cropSize.value = Math.round(Math.min((sys.windowWidth || 375) * 0.72, 320))
  zoom.value = 1
  imgLeft.value = (cropSize.value - naturalW.value * coverScale.value) / 2
  imgTop.value = (cropSize.value - naturalH.value * coverScale.value) / 2
  clampPosition()
}

watch(
  () => [props.visible, props.src] as const,
  async ([visible, src]) => {
    if (!visible || !src) return
    await nextTick()
    uni.getImageInfo({
      src,
      success: (info) => {
        naturalW.value = Math.max(1, info.width || 1)
        naturalH.value = Math.max(1, info.height || 1)
        resetLayout()
      },
      fail: () => {
        naturalW.value = cropSize.value
        naturalH.value = cropSize.value
        resetLayout()
      },
    })
  },
)

let dragging = false
let pinchStartDist = 0
let pinchStartZoom = 1
let lastX = 0
let lastY = 0
const touchPoint = (t: any) => ({
  x: t.clientX ?? t.x ?? 0,
  y: t.clientY ?? t.y ?? 0,
})

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y)

const onTouchStart = (e: any) => {
  const touches = e.touches || []
  if (touches.length >= 2) {
    dragging = false
    const a = touchPoint(touches[0])
    const b = touchPoint(touches[1])
    pinchStartDist = distance(a, b) || 1
    pinchStartZoom = zoom.value
    return
  }
  if (touches.length === 1) {
    dragging = true
    const p = touchPoint(touches[0])
    lastX = p.x
    lastY = p.y
  }
}

const applyZoom = (nextZoom: number, focusX: number, focusY: number) => {
  const prevW = imgW.value
  const prevH = imgH.value
  zoom.value = Math.min(3, Math.max(1, nextZoom))
  const ratio = imgW.value / prevW
  imgLeft.value = focusX - (focusX - imgLeft.value) * ratio
  imgTop.value = focusY - (focusY - imgTop.value) * (imgH.value / prevH)
  clampPosition()
}

const onTouchMove = (e: any) => {
  const touches = e.touches || []
  if (touches.length >= 2) {
    const a = touchPoint(touches[0])
    const b = touchPoint(touches[1])
    const dist = distance(a, b)
    const center = cropSize.value / 2
    applyZoom(pinchStartZoom * (dist / pinchStartDist), center, center)
    return
  }
  if (!dragging || touches.length !== 1) return
  const p = touchPoint(touches[0])
  imgLeft.value += p.x - lastX
  imgTop.value += p.y - lastY
  lastX = p.x
  lastY = p.y
  clampPosition()
}

const onTouchEnd = (e: any) => {
  if ((e.touches || []).length === 0) {
    dragging = false
    pinchStartDist = 0
  }
}

const queryCanvas = () =>
  new Promise<any>((resolve, reject) => {
    const proxy = instance?.proxy as any
    uni
      .createSelectorQuery()
      .in(proxy)
      .select('#avatarCropCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const node = res?.[0]?.node
        if (!node) {
          reject(new Error('裁剪画布初始化失败'))
          return
        }
        resolve(node)
      })
  })

const confirm = async () => {
  if (!props.src || confirming.value) return
  confirming.value = true
  try {
    const canvas = await queryCanvas()
    const dpr = Math.min(3, uni.getSystemInfoSync().pixelRatio || 2)
    const out = props.outputSize
    canvas.width = out * dpr
    canvas.height = out * dpr
    const ctx = canvas.getContext('2d')
    const img = canvas.createImage()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('图片加载失败'))
      img.src = props.src
    })
    const scaleX = naturalW.value / imgW.value
    const scaleY = naturalH.value / imgH.value
    const sx = Math.max(0, -imgLeft.value * scaleX)
    const sy = Math.max(0, -imgTop.value * scaleY)
    const sw = Math.min(naturalW.value - sx, cropSize.value * scaleX)
    const sh = Math.min(naturalH.value - sy, cropSize.value * scaleY)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    const tempPath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath({
        canvas,
        destWidth: out,
        destHeight: out,
        fileType: 'jpg',
        quality: 0.9,
        success: (res) => resolve(res.tempFilePath),
        fail: (err) => reject(err || new Error('导出头像失败')),
      } as any)
    })
    emit('confirm', tempPath)
  } catch (err: any) {
    uni.showToast({ title: err?.message || '裁剪失败', icon: 'none' })
  } finally {
    confirming.value = false
  }
}
</script>

<style scoped>
.crop-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1200;
  background: #111;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx calc(48rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.crop-title,
.crop-hint {
  color: #fff;
  text-align: center;
}
.crop-title {
  font-size: 30rpx;
  font-weight: 600;
  margin-bottom: 36rpx;
}
.crop-hint {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.72);
}
.crop-stage {
  position: relative;
  overflow: hidden;
  border-radius: 50%;
  background: #222;
}
.crop-img {
  position: absolute;
}
.crop-mask {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 4rpx solid rgba(255, 255, 255, 0.9);
  pointer-events: none;
  box-sizing: border-box;
}
.crop-btns {
  display: flex;
  gap: 24rpx;
  width: 100%;
  max-width: 640rpx;
  margin-top: 56rpx;
}
.crop-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 100rpx;
  font-size: 30rpx;
  font-weight: 600;
  margin: 0;
}
.crop-btn.cancel {
  background: #333;
  color: #fff;
}
.crop-btn.confirm {
  background: #3d5a4e;
  color: #fff;
}
.hidden-canvas {
  position: fixed;
  left: -9999px;
  top: 0;
  pointer-events: none;
}
</style>
