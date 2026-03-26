import { Alert } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'

type UploadAsset = {
  uri: string
  name?: string
  type?: string
}

type UploadSource = 'camera' | 'gallery' | 'file'

type PickKycUploadOptions = {
  title?: string
  cameraLabel?: string
  galleryLabel?: string
  fileLabel?: string
}

const extensionFor = (value?: string | null) => {
  const match = value?.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)
  return match?.[1]?.toLowerCase() || null
}

const mimeFromExtension = (extension?: string | null) => {
  switch (extension) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'pdf':
      return 'application/pdf'
    case 'heic':
      return 'image/heic'
    default:
      return 'application/octet-stream'
  }
}

const normalizeAsset = ({ uri, name, type }: UploadAsset): UploadAsset => {
  const extension = extensionFor(name) || extensionFor(uri)
  const normalizedType = type || mimeFromExtension(extension)
  const normalizedName = name || `upload.${extension || 'bin'}`
  return { uri, name: normalizedName, type: normalizedType }
}

const chooseSource = (options: PickKycUploadOptions = {}): Promise<UploadSource | null> =>
  new Promise((resolve) => {
    Alert.alert(options.title || 'Upload document', 'Choose how you want to add this document.', [
      { text: options.cameraLabel || 'Take photo', onPress: () => resolve('camera') },
      { text: options.galleryLabel || 'Choose from gallery', onPress: () => resolve('gallery') },
      { text: options.fileLabel || 'Choose file', onPress: () => resolve('file') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ])
  })

const requestImagePermission = async (source: UploadSource) => {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync()
    return permission.granted
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  return permission.granted
}

const pickFromCamera = async () => {
  const granted = await requestImagePermission('camera')
  if (!granted) throw new Error('Camera permission is required to take a photo.')

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.9,
  })

  if (result.canceled) return null
  const asset = result.assets?.[0]
  if (!asset?.uri) return null

  return normalizeAsset({
    uri: asset.uri,
    name: asset.fileName || undefined,
    type: asset.mimeType || undefined,
  })
}

const pickFromGallery = async () => {
  const granted = await requestImagePermission('gallery')
  if (!granted) throw new Error('Photo library permission is required to choose from gallery.')

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.9,
  })

  if (result.canceled) return null
  const asset = result.assets?.[0]
  if (!asset?.uri) return null

  return normalizeAsset({
    uri: asset.uri,
    name: asset.fileName || undefined,
    type: asset.mimeType || undefined,
  })
}

const pickFromFiles = async () => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  })

  if (result.canceled) return null
  const asset = result.assets?.[0]
  if (!asset?.uri) return null

  return normalizeAsset({
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType || undefined,
  })
}

export const pickKycUpload = async (options: PickKycUploadOptions = {}) => {
  const source = await chooseSource(options)
  if (!source) return null

  if (source === 'camera') return pickFromCamera()
  if (source === 'gallery') return pickFromGallery()
  return pickFromFiles()
}
