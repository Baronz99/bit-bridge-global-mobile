import { useState } from 'react'

const useNotification = () => {
  const [notification, setNotification] = useState({
    error: false,
    message: null,
    data: null,
  })

  return { notification, setNotification }
}

export default useNotification
