import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(false)
  const [user, setUser] = useState(false)

  const login = async () => {}
  const register = async () => {}

  const contextData = {
    session,
    user,
    login,
    register,
  }

  return <AuthContext.Provider value={contextData}>{children}</AuthContext.Provider>
}

const useAuth = () => {
  return useContext(AuthContext)
}
