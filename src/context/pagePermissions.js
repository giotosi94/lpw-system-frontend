import { useEffect, useState } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const PAGE_ROUTES = [
  { key: 'kaizen', prefix: '/kaizen' },
  { key: 'kaizen', prefix: '/major-kaizen' },
  { key: 'action_plan', prefix: '/action-plan' },
  { key: 'meetings', prefix: '/dashboard' },
  { key: 'pillars', prefix: '/pillars' },
  { key: 'documenti', prefix: '/documenti' },
  { key: 'segnalazioni', prefix: '/segnalazioni' },
  { key: 'settings', prefix: '/settings' },
]

let cache = null
const listeners = new Set()

function publish(next) {
  cache = next
  listeners.forEach(listener => listener(next))
}

export function setPagePermissions(data) {
  publish(data)
}

export async function loadPagePermissions() {
  const response = await api.get('/users/permissions/pages')
  publish(response.data)
  return response.data
}

export function pageKeyForPath(pathname) {
  if (pathname === '/') return 'home'
  const match = PAGE_ROUTES.find(route => pathname === route.prefix || pathname.startsWith(route.prefix + '/'))
  return match ? match.key : null
}

export function usePagePermissions() {
  const { user } = useAuth()
  const [data, setData] = useState(cache)
  const [ready, setReady] = useState(Boolean(cache))

  useEffect(() => {
    listeners.add(setData)
    loadPagePermissions()
      .catch(() => {})
      .finally(() => setReady(true))
    return () => {
      listeners.delete(setData)
    }
  }, [])

  const canViewKey = key => {
    if (!user || user.role === 'admin' || !key) return true
    const rolePages = data?.permissions?.[user.role]
    if (!rolePages) return true
    return rolePages[key] !== false
  }

  const canView = pathname => canViewKey(pageKeyForPath(pathname))

  return { ready: ready || user?.role === 'admin', canView, canViewKey }
}
