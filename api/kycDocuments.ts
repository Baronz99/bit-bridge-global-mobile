import client from '@/api/client'

type KycDocumentsPayload = {
  user_profile_id?: string
  id_type?: string
  nin?: string
  address_line1?: string
  address_line2?: string
  city?: string
  state?: string
  country?: string
  postal_code?: string
  proof_of_address_type?: string
  id_document?: { uri: string; name?: string; type?: string } | null
  proof_of_address?: { uri: string; name?: string; type?: string } | null
}

export const updateKycDocuments = async (payload: KycDocumentsPayload) => {
  const form = new FormData()

  if (payload.id_type) {
    form.append('user[id_type]', payload.id_type)
  }

  if (payload.user_profile_id) {
    form.append('user[user_profile_attributes][id]', payload.user_profile_id)
  }

  if (payload.address_line1) {
    form.append('user[user_profile_attributes][address_line1]', payload.address_line1)
  }
  if (payload.address_line2) {
    form.append('user[user_profile_attributes][address_line2]', payload.address_line2)
  }
  if (payload.city) {
    form.append('user[user_profile_attributes][city]', payload.city)
  }
  if (payload.state) {
    form.append('user[user_profile_attributes][state]', payload.state)
  }
  if (payload.country) {
    form.append('user[user_profile_attributes][country]', payload.country)
  }
  if (payload.postal_code) {
    form.append('user[user_profile_attributes][postal_code]', payload.postal_code)
  }
  if (payload.proof_of_address_type) {
    form.append('user[user_profile_attributes][proof_of_address_type]', payload.proof_of_address_type)
  }

  if (payload.id_document?.uri) {
    form.append('user[id_document]', {
      uri: payload.id_document.uri,
      name: payload.id_document.name || 'id_document',
      type: payload.id_document.type || 'application/octet-stream',
    } as any)
  }

  if (payload.proof_of_address?.uri) {
    form.append('user[proof_of_address]', {
      uri: payload.proof_of_address.uri,
      name: payload.proof_of_address.name || 'proof_of_address',
      type: payload.proof_of_address.type || 'application/octet-stream',
    } as any)
  }

  const response = await client.patch('/users/user_update', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}
