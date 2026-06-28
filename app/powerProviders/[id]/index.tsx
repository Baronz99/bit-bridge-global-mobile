import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import React, { useEffect, useMemo, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { images } from '@/constants/images'
import FormInput from '@/components/FormInput'
import FormSelect from '@/components/FormSelect'
import { useAuth } from '@/services/useAuth'
import { createPurchaseOrder } from '@/api/billOrder'
import {
  getServiceStatusSubscriptionStatus,
  subscribeToServiceStatusAlerts,
  unsubscribeFromServiceStatusAlerts,
} from '@/api/notifications'
import { makeElectricityServiceKey } from '@/api/serviceAvailability'
import powerDistribution from '../../../data/powerDistributions.json'
import Loader from '@/components/Loader'
import useNotification from '@/hooks/useNotification'
import AppModal from '@/components/modal/Modal'
import NotificationAlert from '@/components/notification'
import ServiceStatusPill from '@/components/service-availability/ServiceStatusPill'
import useServiceAvailability from '@/hooks/useServiceAvailability'

const getImageByKey = (key: string) => {
  const dict = images as Record<string, any>
  return dict[key] ?? images.fail ?? images.bg
}

const normalizeBiller = (raw: string) => {
  const biller = String(raw || '').trim().toLowerCase()
  if (biller === 'ph') return 'ph'
  return biller
}

const getProviderDisplayName = (provider: (typeof powerDistribution)[number] | undefined) => {
  const raw = String(provider?.name || '').trim()
  if (!raw) return 'Power provider'
  const [primary] = raw.split(' - ')
  return primary.replace(/\s+Payment$/i, '').trim()
}

const getProviderShortCode = (provider: (typeof powerDistribution)[number] | undefined) => {
  const raw = String(provider?.name || '').trim()
  const match = raw.match(/-\s*([A-Z]{3,6})\s*$/)
  if (match?.[1]) return match[1]
  return String(provider?.image || '').trim().toUpperCase()
}

const METER_TYPE_OPTIONS = [
  { label: 'Prepaid', value: 'PREPAID' },
  { label: 'Postpaid', value: 'POSTPAID' },
]

const ProvideDertails = () => {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { userProfileData } = useAuth()
  const { notification, setNotification } = useNotification()
  const { getStatus } = useServiceAvailability()
  const [loader, setLoader] = useState(false)

  const data = powerDistribution.find((item) => String(item.id) === id)
  const serviceKey = useMemo(() => makeElectricityServiceKey(String(data?.biller || '')), [data?.biller])
  const providerDisplayName = useMemo(() => getProviderDisplayName(data), [data])
  const providerShortCode = useMemo(() => getProviderShortCode(data), [data])
  const selectedServiceStatus = useMemo(
    () => getStatus({ provider: data?.biller, serviceType: 'ELECTRICITY', label: providerDisplayName }),
    [data?.biller, getStatus, providerDisplayName]
  )

  const [formValue, setFormValue] = useState({
    billersCode: '',
    amount: '',
    meter_type: 'PREPAID',
    phone: '',
    description: 'Electric Bills',
  })
  const [serviceAlertEnabled, setServiceAlertEnabled] = useState(false)
  const [serviceAlertBusy, setServiceAlertBusy] = useState(false)

  useEffect(() => {
    let active = true

    const loadStatus = async () => {
      if (!serviceKey) return
      try {
        const result = await getServiceStatusSubscriptionStatus({
          provider: 'buypower',
          service_key: serviceKey,
        })
        if (active) {
          setServiceAlertEnabled(result?.subscribed === true)
        }
      } catch {
        if (active) {
          setServiceAlertEnabled(false)
        }
      }
    }

    void loadStatus()
    return () => {
      active = false
    }
  }, [serviceKey])

  const handleServiceAlertToggle = async (nextValue: boolean) => {
    if (!serviceKey || serviceAlertBusy) return

    setServiceAlertBusy(true)
    try {
      if (nextValue) {
        await subscribeToServiceStatusAlerts({
          provider: 'buypower',
          service_key: serviceKey,
          metadata: {
            source: 'electricity_provider_screen',
            providerId: String(id || ''),
          },
        })
      } else {
        await unsubscribeFromServiceStatusAlerts({
          provider: 'buypower',
          service_key: serviceKey,
        })
      }
      setServiceAlertEnabled(nextValue)
    } catch (error: any) {
      setNotification({ error: true, message: error?.message || 'Unable to update alert setting', data: null })
    } finally {
      setServiceAlertBusy(false)
    }
  }

  const handleFormSubmit = async () => {
    const meterNumber = String(formValue.billersCode || '').trim()
    const phone = String(formValue.phone || '').trim()
    const amountRaw = String(formValue.amount || '').trim()
    const meterType = String(formValue.meter_type || '').trim().toUpperCase()
    const amountValue = Number(amountRaw)

    if (!meterNumber) {
      setNotification({ error: true, message: 'Meter number is required', data: null })
      return
    }
    if (!phone) {
      setNotification({ error: true, message: 'Phone number is required', data: null })
      return
    }
    if (!METER_TYPE_OPTIONS.some((opt) => opt.value === meterType)) {
      setNotification({ error: true, message: 'Select a valid meter type', data: null })
      return
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setNotification({ error: true, message: 'Enter a valid amount greater than 0', data: null })
      return
    }
    if (selectedServiceStatus.advice?.can_checkout === false) {
      setNotification({
        error: true,
        message: selectedServiceStatus.advice?.message || 'This service is temporarily unavailable right now.',
        data: null,
      })
      return
    }

    setLoader(true)

    try {
      const response = await createPurchaseOrder({
        billersCode: meterNumber,
        amount: amountValue,
        meter_type: meterType,
        vendType: meterType,
        phone: phone,
        description: formValue.description,
        email: userProfileData.email,
        service_type: 'ELECTRICITY',
        biller: normalizeBiller(String(data?.biller || '')),
      })

      setLoader(false)

      if (response)
        router.push({
          pathname: `/transaction/details`,
          params: {
            id: id,
            orderId: response?.data?.id,
          },
        })
    } catch (error: any) {
      setLoader(false)
      if (error?.code === 'SERVICE_UNAVAILABLE' && serviceKey) {
        setServiceAlertEnabled(true)
      }
      setNotification({ error: true, message: error?.message || 'Something went wrong', data: null })
    }
  }

  return (
    <>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
    >
      <View className="flex-1 bg-primary px-4">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 80,
        }}
        showsVerticalScrollIndicator={false}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View className="mt-6 rounded-3xl border border-gray-800 bg-gray-900/80 p-5">
          <Text className="text-white/70 text-xs tracking-widest uppercase">Utilities</Text>
          <Text className="text-white text-2xl font-semibold mt-2">Pay Power Bills</Text>
          <Text className="text-gray-400 mt-2 text-sm">
            Complete your {providerDisplayName} purchase securely.
          </Text>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Selected Disco</Text>
          <Image
            source={getImageByKey(String(data?.image ?? ''))}
            resizeMode="stretch"
            className="w-full h-40 rounded-2xl mt-4"
          />
          <View className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text className="text-base font-semibold text-white">{providerDisplayName}</Text>
                <Text className="mt-1 text-xs uppercase tracking-[0.8px] text-blue-200">{providerShortCode}</Text>
              </View>
              <ServiceStatusPill state={selectedServiceStatus.state} />
            </View>
            <Text className="mt-2 text-xs text-gray-400">
              {selectedServiceStatus.advice?.message || 'Status currently unavailable. You can still try.'}
            </Text>
          </View>
          <View className="mt-4 flex-row items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <View className="flex-1 pr-4">
              <Text className="text-white font-semibold">Notify me when service is back</Text>
              <Text className="mt-1 text-xs text-gray-400">
                Get a push alert when {providerDisplayName} becomes available again.
              </Text>
            </View>
            <Switch
              value={serviceAlertEnabled}
              onValueChange={handleServiceAlertToggle}
              disabled={serviceAlertBusy || !serviceKey}
            />
          </View>
        </View>

        <View className="mt-6 rounded-2xl border border-gray-800 bg-gray-900/70 p-4">
          <Text className="text-white text-sm font-semibold">Payment Details</Text>
            <View className="mt-3 w-full">
              <FormInput
                name="billerCode"
                label="Meter Number"
                placeHolder="Enter Meter Number"
                onChangeText={(text: string) =>
                  setFormValue({ ...formValue, billersCode: text.trim() })
                }
                value={formValue.billersCode}
              />

              <FormSelect
                label="Meter Type"
                selectedValue={formValue.meter_type}
                options={METER_TYPE_OPTIONS}
                placeholder="Select meter type"
                onValueChange={(value: string) =>
                  setFormValue({ ...formValue, meter_type: String(value || '').toUpperCase() })
                }
              />

              <FormInput
                name="phone"
                label="Phone Number"
                placeHolder="Phone Number"
                onChangeText={(text: string) => setFormValue({ ...formValue, phone: text.trim() })}
                value={formValue.phone}
              />

              <FormInput
                name="amount"
                label="Amount"
                placeHolder="Enter Amount"
                keyboardType="decimal-pad"
                onChangeText={(text: string) => setFormValue({ ...formValue, amount: text.trim() })}
                value={formValue.amount}
              />

              <TouchableOpacity
                onPress={handleFormSubmit}
                disabled={selectedServiceStatus.advice?.can_checkout === false}
                className="bg-app-primary rounded-xl mt-4 py-4"
                style={{ opacity: selectedServiceStatus.advice?.can_checkout === false ? 0.55 : 1 }}
              >
                <Text className="text-white text-center font-semibold">
                  {selectedServiceStatus.advice?.can_checkout === false ? 'Temporarily unavailable' : 'Proceed'}
                </Text>
              </TouchableOpacity>
            </View>
        </View>
      </ScrollView>
      </View>
    </KeyboardAvoidingView>
      <Loader open={loader} />
      <AppModal
        open={!!notification.message}
        onclose={() => setNotification({ message: null, error: false, data: null })}
      >
        <NotificationAlert
          onPress={() => setNotification({ message: null, error: false, data: null })}
          message={notification.message}
          error={notification.error}
          data={notification.data}
        />
      </AppModal>
    </>
  )
}

export default ProvideDertails
