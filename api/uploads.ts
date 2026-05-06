import client from '@/api/client'

const detectMimeType = (uri: string) => {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export const uploadSelfieToCloudinary = async (uri: string) => {
  const normalizedUri = String(uri || '').trim()
  if (!normalizedUri) throw new Error('Selfie image is required')

  const mimeType = detectMimeType(normalizedUri)
  const filename = 'selfie_' + Date.now() + '.' + (mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg')
  const form = new FormData()

  form.append('file', {
    uri: normalizedUri,
    name: filename,
    type: mimeType,
  } as any)

  try {
    const res = await client.post('/cards/selfie_upload', form, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })

    const secureUrl = String(res?.data?.data?.selfie_image_url || '').trim()
    if (!secureUrl) throw new Error('Upload succeeded but secure URL is missing')
    return secureUrl
  } catch (err: any) {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Selfie upload failed'
    throw new Error(String(msg))
  }
}
