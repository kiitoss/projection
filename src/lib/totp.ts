const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function hexToBase32(hex: string): string {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }

  let bits = 0
  let value = 0
  let output = ''

  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

export function buildOtpAuthUri(hexSecret: string, label = 'Projection'): string {
  const b32 = hexToBase32(hexSecret)
  return `otpauth://totp/${encodeURIComponent(label)}?secret=${b32}&issuer=Projection&digits=6&period=30`
}
