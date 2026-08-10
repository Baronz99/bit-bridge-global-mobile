const ENV_KEYS = ['EXPO_PUBLIC_ENV', 'EXPO_PUBLIC_BASE_URL_STAGING', 'EXPO_PUBLIC_BASE_URL_PROD', 'EXPO_PUBLIC_API_BASE_URL'] as const

const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))

const loadConfig = (env: Partial<Record<(typeof ENV_KEYS)[number], string>>) => {
  ENV_KEYS.forEach((key) => {
    if (env[key] === undefined) delete process.env[key]
    else process.env[key] = env[key]
  })
  jest.resetModules()
  let config: typeof import('@/api/baseUrl').default | undefined
  jest.isolateModules(() => {
    config = jest.requireActual<typeof import('@/api/baseUrl')>('@/api/baseUrl').default
  })
  return config as typeof import('@/api/baseUrl').default
}

afterEach(() => {
  ENV_KEYS.forEach((key) => {
    if (savedEnv[key] === undefined) delete process.env[key]
    else process.env[key] = savedEnv[key]
  })
  jest.resetModules()
})

describe('mobile API URL resolution', () => {
  const stagingRoot = 'https://bitbridge-backend-prod-5f0b6abe68d7.herokuapp.com'
  const productionRoot = 'https://api.bitbridgeglobal.com'

  it('uses the explicitly configured staging root and API base', () => {
    const config = loadConfig({
      EXPO_PUBLIC_ENV: 'staging',
      EXPO_PUBLIC_BASE_URL_STAGING: stagingRoot,
      EXPO_PUBLIC_API_BASE_URL: `${stagingRoot}/api/v1`,
    })

    expect(config.env).toBe('staging')
    expect(config.root_url).toBe(stagingRoot)
    expect(config.api_base_url).toBe(`${stagingRoot}/api/v1`)
  })

  it('fails closed when staging URLs are missing', () => {
    expect(() => loadConfig({ EXPO_PUBLIC_ENV: 'staging' })).toThrow(
      'Invalid non-production API configuration'
    )
  })

  it('fails closed when staging URLs are malformed', () => {
    expect(() =>
      loadConfig({
        EXPO_PUBLIC_ENV: 'staging',
        EXPO_PUBLIC_BASE_URL_STAGING: 'http://localhost:3000',
        EXPO_PUBLIC_API_BASE_URL: 'not-a-url',
      })
    ).toThrow('Invalid non-production API configuration')
  })

  it('rejects the production API host in staging', () => {
    expect(() =>
      loadConfig({
        EXPO_PUBLIC_ENV: 'staging',
        EXPO_PUBLIC_API_BASE_URL: `${productionRoot}/api/v1`,
      })
    ).toThrow('The production API host is not allowed')
  })

  it('preserves the production backend contract', () => {
    const config = loadConfig({ EXPO_PUBLIC_ENV: 'production' })

    expect(config.env).toBe('production')
    expect(config.root_url).toBe(productionRoot)
    expect(config.api_base_url).toBe(`${productionRoot}/api/v1`)
  })
})
