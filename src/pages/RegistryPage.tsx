import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './RegistryPage.css'

type RegistryItem = {
  id: string
  name: string
  description: string
  image_url: string
  target_amount: number
  funded_amount: number
  category: string
}

type MomoNetwork = {
  id: string
  name: string
  code: string
  color: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/backend' : 'http://localhost:4000')

const FALLBACK_NETWORKS: MomoNetwork[] = [
  { id: 'mtn', name: 'MTN MoMo', code: '*170#', color: '#ffcc00' },
  { id: 'vodafone', name: 'Vodafone Cash', code: '*110#', color: '#e60000' },
  { id: 'airteltigo', name: 'AirtelTigo Money', code: '*500#', color: '#0066cc' },
]

const CATEGORY_ICONS: Record<string, string> = {
  Experience: '✈️',
  Home: '🏡',
  Charity: '💚',
  General: '🎁',
}

export default function RegistryPage() {
  const [items, setItems] = useState<RegistryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [networks] = useState<MomoNetwork[]>(FALLBACK_NETWORKS)

  // Modal — just pick a network, then dial immediately
  const [modalItem, setModalItem] = useState<{ name: string; target: number } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/registry`)
        if (res.ok) {
          const data = (await res.json()) as { items: RegistryItem[] }
          setItems(data.items)
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  function openModal(name: string, target: number) {
    setModalItem({ name, target })
  }

  function closeModal() {
    setModalItem(null)
  }

  function dialNetwork(net: MomoNetwork) {
    const ussd = net.code.replace('#', '%23')
    window.location.href = `tel:${ussd}`
    closeModal()
  }

  if (loading) {
    return (
      <main className="registry-page">
        <div className="registry-loader"><div className="loader-ring" /></div>
      </main>
    )
  }

  return (
    <main className="registry-page">
      {/* ── Hero ── */}
      <section className="reg-hero">
        <div className="reg-hero-monogram">F &amp; P</div>
        <h1 className="reg-hero-title">Gift Registry</h1>
        <p className="reg-hero-subtitle">
          Your presence is our greatest gift. If you'd like to
          celebrate with us in another way, here are some ideas.
        </p>
      </section>

      {/* ── Product Grid ── */}
      <section className="reg-grid">
        {items.map((item) => {
          const pct = item.target_amount > 0
            ? Math.min(100, Math.round((item.funded_amount / item.target_amount) * 100))
            : 0
          const funded = pct >= 100
          return (
            <article key={item.id} className={`reg-product ${funded ? 'reg-product--funded' : ''}`}>
              <div className="reg-product-thumb">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} loading="lazy" />
                ) : (
                  <span className="reg-product-emoji">
                    {CATEGORY_ICONS[item.category] || '🎁'}
                  </span>
                )}
                {funded && <span className="reg-product-badge">Funded ✓</span>}
              </div>
              <div className="reg-product-info">
                <h3 className="reg-product-name">{item.name}</h3>
                <p className="reg-product-desc">{item.description}</p>
                <div className="reg-product-bar">
                  <div className="reg-product-fill" style={{ width: `${pct}%` }} />
                </div>
                <div className="reg-product-meta">
                  <span>GHS {item.funded_amount.toLocaleString()}</span>
                  <span className="reg-product-target">of {item.target_amount.toLocaleString()}</span>
                </div>
                <button
                  className="reg-product-btn"
                  disabled={funded}
                  onClick={() => openModal(item.name, item.target_amount)}
                >
                  {funded ? 'Fully Funded' : 'Gift This'}
                </button>
              </div>
            </article>
          )
        })}
      </section>

      {/* ── Monetary Gift (tasteful) ── */}
      <section className="reg-monetary">
        <div className="reg-monetary-icon">💌</div>
        <h2 className="reg-monetary-title">A Gift of Your Choice</h2>
        <p className="reg-monetary-desc">
          Prefer to give in your own way? You can send a contribution
          of any amount to help us begin our journey together.
        </p>
        <button className="reg-monetary-btn" onClick={() => openModal('Monetary Gift', 0)}>
          Send via Mobile Money
        </button>
      </section>

      {/* ── Thank You + Footer ── */}
      <div className="reg-thankyou">
        <p>Thank you for being part of our story</p>
      </div>

      <footer className="reg-footer">
        <div className="reg-footer-monogram">F &amp; P</div>
        <div className="reg-footer-links">
          <Link to="/">Home</Link>
          <Link to="/gallery">Gallery</Link>
        </div>
      </footer>

      {/* ── MoMo Modal — pick network & dial ── */}
      {modalItem && (
        <div className="gift-modal-overlay" onClick={closeModal}>
          <div className="gift-modal" onClick={(e) => e.stopPropagation()}>
            <button className="gift-modal-close" onClick={closeModal}>✕</button>
            <h2 className="gift-modal-title">Send a Gift</h2>
            <p className="gift-modal-item">{modalItem.name}</p>
            {modalItem.target > 0 && (
              <p className="gift-modal-amount">
                GHS {modalItem.target.toLocaleString()}
              </p>
            )}
            <p className="gift-modal-prompt">Tap your network to dial</p>
            <div className="network-grid">
              {networks.map((net) => (
                <button
                  key={net.id}
                  className="network-btn"
                  style={{ '--network-color': net.color } as React.CSSProperties}
                  onClick={() => dialNetwork(net)}
                >
                  <span className="network-name">{net.name}</span>
                  <span className="network-code">{net.code}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
