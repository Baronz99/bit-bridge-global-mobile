import client from '@/api/client'

export const saveOnboardingStage = async (onboarding_stage: string) => {
  const res = await client.patch('/users/onboarding_stage', {
    user: { onboarding_stage },
  })
  return res.data
}

export const updateBasicProfile = async (payload: Record<string, any>) => {
  const res = await client.patch('/onboarding/profile', { user: payload })
  return res.data
}

export const updateKycProfile = async (payload: Record<string, any>) => {
  const {
    id_type,
    id_document,
    proof_of_address,
    ...profileFields
  } = payload || {}

  const body: Record<string, any> = {
    user: {
      user_profile_attributes: profileFields,
    },
  }

  if (id_type) body.user.id_type = id_type
  if (id_document) body.user.id_document = id_document
  if (proof_of_address) body.user.proof_of_address = proof_of_address

  const res = await client.patch('/users/basic_profile', body)
  return res.data
}

export const saveOnboardingUseCase = async (payload: {
  primary_use_case: string
  onboarding_stage?: string
}) => {
  const res = await client.patch('/onboarding/use_case', payload)
  return res.data
}
