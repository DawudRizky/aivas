import crypto from 'crypto'

const QR_PREFIX = 'AIVAS2'
const QR_SECRET = process.env.QR_SECRET || process.env.JWT_SECRET || 'replace_this_with_env_secret'
const QR_KEY = crypto.createHash('sha256').update(QR_SECRET).digest()

type QrPayload = {
  delivery_order_item_id: number
  [key: string]: unknown
}

const encodeBase64Url = (value: Buffer) => value.toString('base64url')
const decodeBase64Url = (value: string) => Buffer.from(value, 'base64url')

export function encryptQrPayload(payload: QrPayload) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', QR_KEY, iv)
  cipher.setAAD(Buffer.from(QR_PREFIX, 'utf8'))

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [
    QR_PREFIX,
    encodeBase64Url(iv),
    encodeBase64Url(encrypted),
    encodeBase64Url(tag),
  ].join('.')
}

export function decryptQrPayload(token: string): QrPayload | null {
  const parts = String(token || '').trim().split('.')
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) {
    return null
  }

  try {
    const [, ivPart, encryptedPart, tagPart] = parts
    const decipher = crypto.createDecipheriv('aes-256-gcm', QR_KEY, decodeBase64Url(ivPart))
    decipher.setAAD(Buffer.from(QR_PREFIX, 'utf8'))
    decipher.setAuthTag(decodeBase64Url(tagPart))

    const decrypted = Buffer.concat([
      decipher.update(decodeBase64Url(encryptedPart)),
      decipher.final(),
    ]).toString('utf8')

    const parsed = JSON.parse(decrypted) as QrPayload
    if (!parsed || !Number.isFinite(Number(parsed.delivery_order_item_id))) {
      return null
    }

    return {
      ...parsed,
      delivery_order_item_id: Number(parsed.delivery_order_item_id),
    }
  } catch {
    return null
  }
}
