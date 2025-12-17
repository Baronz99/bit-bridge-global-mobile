import { useState } from 'react'
interface NotificationType<T = any> {
  error: boolean
  message: string | null
  data: T | null
}

const useNotification = <T = any>() => {
  const [notification, setNotification] = useState<NotificationType<T>>({
    error: false,
    message: null,
    data: null,
  })

  return { notification, setNotification }
}

export default useNotification
