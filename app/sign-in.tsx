import { useEffect } from 'react'
import { useRouter } from 'expo-router'

const SignIn = () => {
  const router = useRouter()

  useEffect(() => {
    router.replace('/login')
  }, [router])

  return null
}

export default SignIn
