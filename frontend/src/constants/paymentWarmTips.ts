/** 来访支付 / 确认订单页「温馨提示」统一文案 */
export const PAYMENT_WARM_TIPS = [
  '咨询采用预约制，请确认参加本次咨询的时间，费用，地点，咨询师将为您预留出相应时间；',
  '支付成功后预约立即生效；',
  '如需改约或取消，也请至少提前24小时联系我们；',
  '在咨询开始前24小时内临时取消咨询或爽约，将计为一节正式咨询，不予退款，除非双方另行协商一致；',
  '请注意预定的咨询时间，如有迟到，咨询时间不做延长；',
  '有任何问题可随时给助理留言，我们将在工作时间9-21点内进行回复。',
] as const

/** 免费确认单：第二句改为「确认后」 */
export function paymentWarmTipsForOrder(options?: { free?: boolean }): string[] {
  const tips = [...PAYMENT_WARM_TIPS]
  if (options?.free) {
    tips[1] = '确认后预约立即生效；'
  }
  return tips
}
