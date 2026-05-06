import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native'
import ScreenContainer from '@/components/ScreenContainer'
import { createBusinessMembership, getBusinessMemberships } from '@/api/business'
import { buildApiErrorMessage } from '@/utils/apiErrorMessage'
import { useActiveAccount } from '@/services/useActiveAccount'
import { log } from '@/utils/logger'

const roleTone = (role: any) => {
  const normalized = String(role || '').toLowerCase()
  if (normalized === 'owner') return 'text-emerald-300'
  if (normalized === 'admin') return 'text-[#FFD2A0]'
  if (normalized === 'approver') return 'text-blue-300'
  return 'text-gray-300'
}

const ROLE_OPTIONS = ['approver', 'admin', 'viewer']

const BusinessTeamScreen = () => {
  const { activeAccount } = useActiveAccount()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [memberships, setMemberships] = useState<Record<string, any>[]>([])
  const [currentUserRole, setCurrentUserRole] = useState<string>('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('approver')
  const businessId = activeAccount.type === 'business' ? activeAccount.businessId : null

  const emitTeamEvent = (event: string, extra: Record<string, unknown> = {}) => {
    log('[BUSINESS_FLOW]', {
      event,
      businessId,
      ...extra,
    })
  }

  const loadTeam = useCallback(async (options?: { silent?: boolean }) => {
    if (!businessId) {
      setLoading(false)
      return
    }

    const silent = options?.silent === true
    if (!silent) setLoading(true)
    setErrorMessage(null)
    try {
      const response = await getBusinessMemberships(businessId)
      const data = response?.data?.data || {}
      setMemberships(Array.isArray(data.memberships) ? data.memberships : [])
      setCurrentUserRole(String(data.current_user_role || ''))
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to load the business team right now.',
      })
      setErrorMessage(message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    loadTeam()
  }, [loadTeam])

  const canManageTeam = ['owner', 'admin'].includes(String(currentUserRole || '').toLowerCase())

  const handleInvite = async () => {
    if (!businessId) return
    if (!email.trim()) {
      setErrorMessage('Team member email is required.')
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const response = await createBusinessMembership(businessId, {
        membership: {
          email: email.trim(),
          role,
        },
      })
      const data = response?.data?.data || {}
      setMemberships(Array.isArray(data.memberships) ? data.memberships : memberships)
      setEmail('')
      setRole('approver')
      setSuccessMessage('Team member added.')
      emitTeamEvent('business_team_member_added', {
        role,
      })
    } catch (error: any) {
      const message = buildApiErrorMessage({
        status: error?.response?.status,
        data: error?.response?.data,
        fallback: 'Unable to add the team member right now.',
      })
      setErrorMessage(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ScreenContainer topPadding={20}>
      <View className="rounded-[28px] border border-[#FF7A18]/40 bg-[#151A22] p-5">
        <Text className="text-[#FFB05A] text-[11px] uppercase tracking-[2px]">Business team</Text>
        <Text className="text-white text-2xl font-semibold mt-3">Business account</Text>
        <Text className="text-gray-300 text-sm mt-2">
          Review the people who can act on this business account and keep approvals separated from personal access.
        </Text>
      </View>

      {errorMessage ? (
        <View className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-4">
          <Text className="text-red-100 text-sm">{errorMessage}</Text>
        </View>
      ) : null}

      {successMessage ? (
        <View className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
          <Text className="text-emerald-100 text-sm">{successMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View className="py-10 items-center justify-center">
          <ActivityIndicator size="small" color="#FFB05A" />
          <Text className="text-white mt-3">Loading business team...</Text>
        </View>
      ) : null}

      {!loading ? (
        <>
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Current role</Text>
            <Text className="text-white text-sm mt-2 capitalize">{currentUserRole || 'viewer'}</Text>
          </View>

          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Company operators</Text>
            <View className="mt-4 gap-3">
              {memberships.length ? memberships.map((membership) => (
                <View key={String(membership.id)} className="rounded-2xl border border-gray-800 bg-gray-950/45 px-4 py-4">
                  <Text className="text-white text-sm font-semibold">{membership.email || 'Unknown email'}</Text>
                  <Text className={`text-xs mt-1 capitalize ${roleTone(membership.role)}`}>{membership.role || 'viewer'}</Text>
                </View>
              )) : (
                <Text className="text-gray-400 text-sm">No team members are assigned yet.</Text>
              )}
            </View>
          </View>

          {canManageTeam ? (
          <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
            <Text className="text-white text-base font-semibold">Add team member</Text>
            <Text className="text-gray-400 text-sm mt-2">Invite the people who should review approvals, prepare payroll, or manage this company account.</Text>

              <Text className="text-gray-400 text-xs mt-4">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="name@company.com"
                placeholderTextColor="#6B7280"
                className="mt-2 rounded-2xl border border-gray-700 bg-gray-950/45 px-4 py-4 text-white"
              />

              <Text className="text-gray-400 text-xs mt-4">Role</Text>
              <View className="mt-2 flex-row flex-wrap gap-2">
                {ROLE_OPTIONS.map((option) => {
                  const active = role === option
                  return (
                    <TouchableOpacity
                      key={option}
                      onPress={() => setRole(option)}
                      className={`rounded-2xl border px-4 py-3 ${active ? 'border-[#FFB05A] bg-[#FFB05A]/12' : 'border-gray-700 bg-gray-950/45'}`}
                    >
                      <Text className="text-white text-xs font-semibold capitalize">{option}</Text>
                    </TouchableOpacity>
                  )
                })}
              </View>

              <TouchableOpacity onPress={handleInvite} disabled={submitting} className="mt-4 rounded-2xl bg-[#FFB05A] px-4 py-4 items-center">
                {submitting ? <ActivityIndicator size="small" color="#111827" /> : <Text className="text-black text-sm font-semibold">Add team member</Text>}
              </TouchableOpacity>
              <Text className="text-slate-500 text-xs mt-3">
                Add at least one operator now so payroll and approvals are easier to run from the first funded cycle.
              </Text>
            </View>
          ) : (
            <View className="mt-4 rounded-2xl border border-gray-800 bg-gray-900/80 p-4">
              <Text className="text-gray-300 text-sm">Only owners and admins can manage business team access.</Text>
            </View>
          )}
        </>
      ) : null}
    </ScreenContainer>
  )
}

export default BusinessTeamScreen
