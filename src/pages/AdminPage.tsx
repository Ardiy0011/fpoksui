import { useCallback, useEffect, useState } from 'react'
import './AdminPage.css'

type MediaItem = {
  id: string
  type: 'image' | 'video'
  original_name: string
  url_thumb: string
  guest_fingerprint: string
  session_token: string
  status: string
  created_at: string
}

type RegistryItem = {
  id: string
  name: string
  description: string
  image_url: string
  target_amount: number
  funded_amount: number
  category: string
  is_visible: boolean
}

const API_BASE_URL = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim()
  if (!raw) return import.meta.env.PROD ? '/backend' : 'http://localhost:4000'

  // Prevent mixed-content on HTTPS deployments when an HTTP env is accidentally set.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && raw.startsWith('http://')) {
    return '/backend'
  }

  return raw.endsWith('/') ? raw.slice(0, -1) : raw
})()

function resolveUrl(url: string) {
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url
}

export default function AdminPage() {
  const [token, setToken] = useState(() => localStorage.getItem('finpok_admin_token') || '')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  const [tab, setTab] = useState<'media' | 'registry' | 'settings'>('media')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [registry, setRegistry] = useState<RegistryItem[]>([])
  const [uploadLimit, setUploadLimit] = useState(5)
  const [statusMsg, setStatusMsg] = useState('')

  // Registry form
  const [newItem, setNewItem] = useState({ name: '', description: '', image_url: '', target_amount: '', category: 'General' })

  const headers = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }), [token])

  async function handleLogin() {
    if (!email || !password) return
    setLoggingIn(true)
    setLoginError('')

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as { token?: string; error?: string }

      if (!res.ok) throw new Error(data.error || 'Login failed')

      setToken(data.token!)
      localStorage.setItem('finpok_admin_token', data.token!)
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoggingIn(false)
    }
  }

  function handleLogout() {
    setToken('')
    localStorage.removeItem('finpok_admin_token')
  }

  // Load data when authenticated
  useEffect(() => {
    if (!token) return

    async function load() {
      try {
        const [mediaRes, registryRes, settingsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/admin/media`, { headers: headers() }),
          fetch(`${API_BASE_URL}/api/admin/registry`, { headers: headers() }),
          fetch(`${API_BASE_URL}/api/admin/settings`, { headers: headers() }),
        ])

        if (mediaRes.status === 401 || registryRes.status === 401) {
          handleLogout()
          return
        }

        if (mediaRes.ok) {
          const d = (await mediaRes.json()) as { items: MediaItem[] }
          setMedia(d.items)
        }
        if (registryRes.ok) {
          const d = (await registryRes.json()) as { items: RegistryItem[] }
          setRegistry(d.items)
        }
        if (settingsRes.ok) {
          const d = (await settingsRes.json()) as { global_upload_limit?: number }
          if (d.global_upload_limit) setUploadLimit(d.global_upload_limit)
        }
      } catch {
        setStatusMsg('Could not load data. Server may be offline.')
      }
    }

    void load()
  }, [token, headers])

  async function deleteMedia(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/admin/media/${id}`, { method: 'DELETE', headers: headers() })
    if (res.ok) {
      setMedia((prev) => prev.filter((m) => m.id !== id))
      setStatusMsg('Media deleted.')
    }
  }

  async function saveUploadLimit() {
    await fetch(`${API_BASE_URL}/api/admin/settings`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ global_upload_limit: uploadLimit }),
    })
    setStatusMsg(`Upload limit updated to ${uploadLimit}.`)
  }

  async function addRegistryItem() {
    if (!newItem.name || !newItem.target_amount) {
      setStatusMsg('Name and target amount are required.')
      return
    }

    const res = await fetch(`${API_BASE_URL}/api/admin/registry`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ ...newItem, target_amount: parseFloat(newItem.target_amount) }),
    })

    if (res.ok) {
      const item = (await res.json()) as RegistryItem
      setRegistry((prev) => [item, ...prev])
      setNewItem({ name: '', description: '', image_url: '', target_amount: '', category: 'General' })
      setStatusMsg('Registry item added.')
    }
  }

  async function deleteRegistryItem(id: string) {
    const res = await fetch(`${API_BASE_URL}/api/admin/registry/${id}`, { method: 'DELETE', headers: headers() })
    if (res.ok) {
      setRegistry((prev) => prev.filter((r) => r.id !== id))
      setStatusMsg('Item deleted.')
    }
  }

  // ── Login Screen ──
  if (!token) {
    return (
      <main className="admin-page">
        <div className="admin-login">
          <h1 className="admin-login-title">Admin Access</h1>
          <div className="admin-login-form">
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
            {loginError && <p className="admin-error">{loginError}</p>}
            <button onClick={handleLogin} disabled={loggingIn}>{loggingIn ? 'Logging in...' : 'Log In'}</button>
          </div>
          <p className="admin-dev-hint">Dev: admin@finpok.local / admin123</p>
        </div>
      </main>
    )
  }

  // ── Dashboard ──
  return (
    <main className="admin-page">
      <header className="admin-header">
        <h1>Dashboard</h1>
        <button className="admin-logout" onClick={handleLogout}>Log Out</button>
      </header>

      <nav className="admin-tabs">
        <button className={tab === 'media' ? 'active' : ''} onClick={() => setTab('media')}>Media ({media.length})</button>
        <button className={tab === 'registry' ? 'active' : ''} onClick={() => setTab('registry')}>Registry ({registry.length})</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
      </nav>

      {statusMsg && <p className="admin-status">{statusMsg}</p>}

      {/* Media Tab */}
      {tab === 'media' && (
        <section className="admin-section">
          {media.length === 0 ? (
            <p className="admin-empty">No uploads yet.</p>
          ) : (
            <div className="admin-media-grid">
              {media.map((item) => (
                <div key={item.id} className="admin-media-card">
                  <div className="admin-media-thumb">
                    {item.type === 'image' && item.url_thumb ? (
                      <img src={resolveUrl(item.url_thumb)} alt="" />
                    ) : (
                      <span className="admin-media-icon">{item.type === 'image' ? '📷' : '🎥'}</span>
                    )}
                  </div>
                  <div className="admin-media-info">
                    <span className="admin-media-name">{item.original_name}</span>
                    <span className="admin-media-meta">{item.type} • {item.status}</span>
                  </div>
                  <button className="admin-delete-btn" onClick={() => deleteMedia(item.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Registry Tab */}
      {tab === 'registry' && (
        <section className="admin-section">
          <div className="admin-registry-form">
            <h3>Add Registry Item</h3>
            <input placeholder="Item name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} />
            <input placeholder="Description" value={newItem.description} onChange={(e) => setNewItem({ ...newItem, description: e.target.value })} />
            <input placeholder="Image URL" value={newItem.image_url} onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })} />
            <input type="number" placeholder="Target amount (GHS)" value={newItem.target_amount} onChange={(e) => setNewItem({ ...newItem, target_amount: e.target.value })} />
            <input placeholder="Category" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} />
            <button onClick={addRegistryItem}>Add Item</button>
          </div>

          {registry.length > 0 && (
            <div className="admin-registry-list">
              {registry.map((item) => (
                <div key={item.id} className="admin-registry-card">
                  <div>
                    <strong>{item.name}</strong>
                    <span className="admin-registry-progress">
                      GHS {item.funded_amount} / {item.target_amount}
                    </span>
                  </div>
                  <button className="admin-delete-btn" onClick={() => deleteRegistryItem(item.id)}>Delete</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Settings Tab */}
      {tab === 'settings' && (
        <section className="admin-section">
          <div className="admin-setting-row">
            <label>
              <span>Upload limit per guest</span>
              <input
                type="number"
                min={1}
                max={50}
                value={uploadLimit}
                onChange={(e) => setUploadLimit(Number(e.target.value))}
              />
            </label>
            <button onClick={saveUploadLimit}>Save</button>
          </div>
        </section>
      )}
    </main>
  )
}
