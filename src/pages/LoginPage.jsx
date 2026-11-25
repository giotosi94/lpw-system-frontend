import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { clearDevice, getDeviceToken, nfcSupported, startNfcScan } from '../services/badgeReader'
import lpwSystemLogo from '../assets/lpw-system-logo.png'

export default function LoginPage() {
  const [upn, setUpn] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, setSession } = useAuth()
  const navigate = useNavigate()
  const [deviceToken, setDeviceTokenState] = useState(getDeviceToken())
  const [badgeCode, setBadgeCode] = useState('')
  const [badgeMessage, setBadgeMessage] = useState('')
  const [scanning, setScanning] = useState(false)
  const stopScan = useRef(null)
  const lastRead = useRef({ uid: '', at: 0 })
  const badgeBusy = useRef(false)

  const badgeLogin = async uid => {
    const now = Date.now()
    if (badgeBusy.current) return
    if (lastRead.current.uid === uid && now - lastRead.current.at < 2000) return
    lastRead.current = { uid, at: now }
    badgeBusy.current = true
    setError('')
    try {
      const res = await api.post('/badges/login', { uid }, { headers: { 'X-Device-Token': getDeviceToken() } })
      setSession(res.data)
      navigate('/')
    } catch (err) {
      if (err.response?.status === 403) {
        clearDevice()
        setDeviceTokenState(null)
        setScanning(false)
      }
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Badge non riconosciuto')
    } finally {
      badgeBusy.current = false
    }
  }

  const startScan = async () => {
    setBadgeMessage('')
    try {
      stopScan.current = await startNfcScan(badgeLogin, setBadgeMessage)
      setScanning(true)
    } catch (err) {
      setScanning(false)
      setBadgeMessage('Lettura NFC non disponibile su questo dispositivo')
    }
  }

  useEffect(() => {
    if (!deviceToken || !nfcSupported()) return undefined
    let cancelled = false
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'nfc' }).then(status => {
        if (status.state === 'granted' && !cancelled) startScan()
      }).catch(() => {})
    }
    return () => {
      cancelled = true
      if (stopScan.current) stopScan.current()
    }
  }, [deviceToken])

  const handleBadgeSubmit = event => {
    event.preventDefault()
    const code = badgeCode.trim()
    setBadgeCode('')
    if (code) badgeLogin(code)
  }

  const handleSubmit = async event => {
    event.preventDefault()
    setError('')
    if (!upn.trim() || !password) {
      setError('Inserisci utente e password')
      return
    }
    setLoading(true)
    try {
      await login(upn.trim(), password)
      navigate('/')
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Errore di login')
    } finally {
      setPassword('')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={lpwSystemLogo}
            alt="LPW System"
            className="w-32 h-32 object-contain mx-auto mb-3 mix-blend-multiply"
          />
          <h1 className="text-3xl font-bold text-primary">
            LPW System
          </h1>
          <p className="text-gray-500 mt-2">
            Lindt Performance Way
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Utente aziendale
            </label>
            <input
              type="text"
              value={upn}
              onChange={event => setUpn(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="nome.cognome@lindt.com"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password Windows
            </label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-primary-light transition-colors disabled:opacity-50"
          >
            {loading ? 'Accesso...' : 'Accedi'}
          </button>
        </form>
        {deviceToken && (
          <div className="mt-6 pt-5 border-t border-gray-200">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Accesso con badge</h2>
            <form onSubmit={handleBadgeSubmit} className="space-y-2">
              <input
                type="text"
                value={badgeCode}
                onChange={event => setBadgeCode(event.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Passa il badge sul lettore"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-label="Codice badge"
              />
              {nfcSupported() && (
                <button
                  type="button"
                  onClick={startScan}
                  disabled={scanning}
                  className="w-full border border-primary text-primary py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  {scanning ? 'In attesa del badge...' : 'Attiva lettura badge'}
                </button>
              )}
              {badgeMessage && <p className="text-xs text-gray-500">{badgeMessage}</p>}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
