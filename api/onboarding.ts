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
  const res = await client.patch('/users/basic_profile', { user: payload })
  return res.data
}

export const saveOnboardingUseCase = async (payload: {
  primary_use_case: string
  onboarding_stage?: string
}) => {
  const res = await client.patch('/onboarding/use_case', payload)
  return res.data
}
