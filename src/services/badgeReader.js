export const BADGE_TOKEN_KEY = 'badge_device_token'
export const BADGE_ID_KEY = 'badge_device_id'

export function getDeviceToken() {
  return localStorage.getItem(BADGE_TOKEN_KEY)
}

export function getDeviceId() {
  return localStorage.getItem(BADGE_ID_KEY)
}

export function setDevice(id, token) {
  localStorage.setItem(BADGE_ID_KEY, id)
  localStorage.setItem(BADGE_TOKEN_KEY, token)
}

export function clearDevice() {
  localStorage.removeItem(BADGE_ID_KEY)
  localStorage.removeItem(BADGE_TOKEN_KEY)
}

export function nfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window
}

export async function startNfcScan(onUid, onError) {
  const controller = new AbortController()
  const reader = new window.NDEFReader()
  reader.addEventListener('reading', event => {
    if (event.serialNumber) onUid(event.serialNumber)
  })
  reader.addEventListener('readingerror', () => {
    if (onError) onError('Badge non leggibile, riprova')
  })
  await reader.scan({ signal: controller.signal })
  return () => controller.abort()
}
