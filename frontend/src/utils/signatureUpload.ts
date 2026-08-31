/** 真机 lime-signature 可能返回 base64，uploadFile 只接受本地临时路径。 */

const DATA_URL_RE = /^data:image\/(\w+);base64,(.+)$/i

export function isSignatureDataUrl(value: string): boolean {
  return DATA_URL_RE.test(String(value || '').trim())
}

function getWxUserDataPath(): string {
  const wxAny = wx as WechatMiniprogram.Wx & { env?: { USER_DATA_PATH?: string } }
  const path = wxAny.env?.USER_DATA_PATH
  if (!path) throw new Error('无法获取小程序用户目录')
  return path
}

export function dataUrlToLocalPath(dataUrl: string): Promise<string> {
  const match = DATA_URL_RE.exec(String(dataUrl || '').trim())
  if (!match) return Promise.reject(new Error('签名图片格式无效'))

  const [, format, body] = match
  const filePath = `${getWxUserDataPath()}/signature_${Date.now()}.${format}`

  return new Promise((resolve, reject) => {
    uni.getFileSystemManager().writeFile({
      filePath,
      data: body,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: err => reject(err),
    })
  })
}

/** 上传前统一转为 wx.uploadFile 可用的本地路径。 */
export async function resolveSignatureUploadPath(filePath: string): Promise<string> {
  const value = String(filePath || '').trim()
  if (!value) throw new Error('签名文件不存在，请重新签字')
  if (isSignatureDataUrl(value)) return dataUrlToLocalPath(value)
  return value
}
