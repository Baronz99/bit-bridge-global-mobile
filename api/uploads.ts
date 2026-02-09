import * as FileSystem from 'expo-file-system'

const cloudName = String(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || '').trim()
const uploadPreset = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '').trim()
const uploadFolder = String(process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_FOLDER || 'bitbridge/selfies').trim()

const ensureCloudinaryConfig = () => {
  if (!cloudName || !uploadPreset) {
    throw new Error('Selfie upload is not configured. Set Cloudinary env vars.')
  }
}

const detectMimeType = (uri: string) => {
  const lower = uri.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

export const uploadSelfieToCloudinary = async (uri: string) => {
  ensureCloudinaryConfig()
  if (!uri) throw new Error('Selfie image is required')

  const fileInfo = await FileSystem.getInfoAsync(uri)
  if (!fileInfo.exists) throw new Error('Selfie image not found')

  const mimeType = detectMimeType(uri)
  const filename = `selfie_${Date.now()}.${mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'}`
  const form = new FormData()

  form.append('file', {
    uri,
    name: filename,
    type: mimeType,
  } as any)
  form.append('upload_preset', uploadPreset)
  form.append('folder', uploadFolder)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = json?.error?.message || json?.message || 'Selfie upload failed'
    throw new Error(msg)
  }

  const secureUrl = String(json?.secure_url || '').trim()
  if (!secureUrl) throw new Error('Upload succeeded but secure URL is missing')
  return secureUrl
}

