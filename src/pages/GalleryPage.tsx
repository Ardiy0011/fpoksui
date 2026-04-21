import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { io as socketIo } from 'socket.io-client'
import './GalleryPage.css'

import journeyImg1 from '../assets/Journeyimages/photo_2026-04-20_11-49-20.jpg'
import journeyImg2 from '../assets/Journeyimages/photo_2026-04-20_11-49-23.jpg'
import journeyImg3 from '../assets/Journeyimages/photo_2026-04-20_11-49-25.jpg'
import journeyImg4 from '../assets/Journeyimages/photo_2026-04-20_11-49-28.jpg'
import journeyImg5 from '../assets/Journeyimages/photo_2026-04-20_11-49-31.jpg'
import journeyImg6 from '../assets/Journeyimages/photo_2026-04-20_11-49-33.jpg'
import journeyImg7 from '../assets/Journeyimages/photo_2026-04-20_11-49-36.jpg'
import journeyImg8 from '../assets/Journeyimages/photo_2026-04-20_11-49-45.jpg'
import journeyImg9 from '../assets/Journeyimages/photo_2026-04-20_11-49-48.jpg'
import journeyImg10 from '../assets/Journeyimages/photo_2026-04-20_11-49-51.jpg'

type GalleryItem = {
  id: string
  type: 'image' | 'video'
  url_thumb: string
  url_medium: string
  url_full: string
  created_at: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'

function resolveUrl(url: string) {
  if (url.startsWith('/uploads') || url.startsWith('/api')) {
    return `${API_BASE_URL}${url}`
  }
  return url
}

/* Dummy images from Journey folder shown when the real gallery is empty */
const DUMMY_ITEMS: GalleryItem[] = [
  { id: 'd1', type: 'image', url_thumb: journeyImg1, url_medium: journeyImg1, url_full: journeyImg1, created_at: '2026-04-25T10:00:00Z' },
  { id: 'd2', type: 'image', url_thumb: journeyImg2, url_medium: journeyImg2, url_full: journeyImg2, created_at: '2026-04-25T10:05:00Z' },
  { id: 'd3', type: 'image', url_thumb: journeyImg3, url_medium: journeyImg3, url_full: journeyImg3, created_at: '2026-04-25T10:10:00Z' },
  { id: 'd4', type: 'image', url_thumb: journeyImg4, url_medium: journeyImg4, url_full: journeyImg4, created_at: '2026-04-25T10:15:00Z' },
  { id: 'd5', type: 'image', url_thumb: journeyImg5, url_medium: journeyImg5, url_full: journeyImg5, created_at: '2026-04-25T10:20:00Z' },
  { id: 'd6', type: 'image', url_thumb: journeyImg6, url_medium: journeyImg6, url_full: journeyImg6, created_at: '2026-04-25T10:25:00Z' },
  { id: 'd7', type: 'image', url_thumb: journeyImg7, url_medium: journeyImg7, url_full: journeyImg7, created_at: '2026-04-25T10:30:00Z' },
  { id: 'd8', type: 'image', url_thumb: journeyImg8, url_medium: journeyImg8, url_full: journeyImg8, created_at: '2026-04-25T10:35:00Z' },
  { id: 'd9', type: 'image', url_thumb: journeyImg9, url_medium: journeyImg9, url_full: journeyImg9, created_at: '2026-04-25T10:40:00Z' },
  { id: 'd10', type: 'image', url_thumb: journeyImg10, url_medium: journeyImg10, url_full: journeyImg10, created_at: '2026-04-25T10:45:00Z' },
]

export default function GalleryPage() {
  const { token = 'fp-live-2026' } = useParams()
  const [items, setItems] = useState<GalleryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const notifyTimer = useRef<number>(0)

  async function loadGallery() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/gallery/${token}`)
      if (res.ok) {
        const data = (await res.json()) as { items: GalleryItem[] }
        setItems(data.items)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadGallery()
  }, [token])

  function showNotification(msg: string) {
    window.clearTimeout(notifyTimer.current)
    setNotification(null)
    // Force re-render so animation restarts
    requestAnimationFrame(() => {
      setNotification(msg)
      notifyTimer.current = window.setTimeout(() => setNotification(null), 3200)
    })
  }

  // Real-time updates
  useEffect(() => {
    const socket = socketIo(API_BASE_URL, { transports: ['websocket', 'polling'] })
    socket.on('connect', () => {
      socket.emit('join:session', token)
    })
    socket.on('media:new', () => {
      void loadGallery()
      showNotification('A guest just shared a photo ✨')
    })
    socket.on('media:deleted', () => void loadGallery())
    return () => { socket.disconnect() }
  }, [token])

  useEffect(() => {
    return () => window.clearTimeout(notifyTimer.current)
  }, [])

  /* Use real items if available, otherwise show dummy placeholders */
  const displayItems = items.length > 0 ? items : DUMMY_ITEMS
  const filtered = filter === 'all' ? displayItems : displayItems.filter((i) => i.type === filter)

  if (loading) {
    return (
      <main className="gallery-page">
        <div className="gallery-loader"><div className="loader-ring" /></div>
      </main>
    )
  }

  return (
    <main className="gallery-page">
      {notification && (
        <div className="gallery-notification" key={notification}>
          {notification}
        </div>
      )}

      <header className="gallery-header">
        <Link to="/" className="gallery-back">← Home</Link>
        <h1 className="gallery-title">Photo Gallery</h1>
      </header>

      <div className="gallery-filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-btn ${filter === 'image' ? 'active' : ''}`} onClick={() => setFilter('image')}>Photos</button>
        <button className={`filter-btn ${filter === 'video' ? 'active' : ''}`} onClick={() => setFilter('video')}>Videos</button>
        <span className="filter-count">{filtered.length} items</span>
      </div>

      <div className="gallery-grid">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="gallery-card"
            onClick={() => { setLightbox(item); setMenuOpen(false) }}
            role="button"
            tabIndex={0}
          >
            {item.type === 'image' ? (
              <img src={resolveUrl(item.url_thumb)} alt="" loading="lazy" />
            ) : (
              <div className="gallery-video-thumb">
                <video src={resolveUrl(item.url_thumb)} muted preload="metadata" />
                <span className="play-icon">▶</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => { setLightbox(null); setMenuOpen(false) }} role="dialog">
          <button className="lightbox-close" onClick={() => { setLightbox(null); setMenuOpen(false) }}>✕</button>

          {/* Prev / Next arrows */}
          {(() => {
            const idx = filtered.findIndex((i) => i.id === lightbox.id)
            return (
              <>
                {idx > 0 && (
                  <button
                    className="lightbox-arrow lightbox-arrow--prev"
                    onClick={(e) => { e.stopPropagation(); setLightbox(filtered[idx - 1]); setMenuOpen(false) }}
                    aria-label="Previous"
                  >
                    ‹
                  </button>
                )}
                {idx < filtered.length - 1 && (
                  <button
                    className="lightbox-arrow lightbox-arrow--next"
                    onClick={(e) => { e.stopPropagation(); setLightbox(filtered[idx + 1]); setMenuOpen(false) }}
                    aria-label="Next"
                  >
                    ›
                  </button>
                )}
              </>
            )
          })()}

          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            {lightbox.type === 'image' ? (
              <img src={resolveUrl(lightbox.url_full)} alt="" />
            ) : (
              <video src={resolveUrl(lightbox.url_full)} controls autoPlay />
            )}
            <div className="lightbox-actions">
              <a
                href={resolveUrl(lightbox.url_full)}
                download
                className="lightbox-action-btn"
                title="Download"
                onClick={(e) => e.stopPropagation()}
              >
                ↓
              </a>
              <button
                type="button"
                className="lightbox-action-btn"
                title="More options"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              >
                ⋯
                {menuOpen && (
                  <div className="lightbox-menu" onClick={(e) => e.stopPropagation()}>
                    <a
                      href={resolveUrl(lightbox.url_full)}
                      download
                      className="lightbox-menu-item"
                    >
                      📥 Download Full Size
                    </a>
                    <a
                      href={resolveUrl(lightbox.url_medium)}
                      download
                      className="lightbox-menu-item"
                    >
                      📱 Download Medium
                    </a>
                    <button
                      type="button"
                      className="lightbox-menu-item"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(resolveUrl(lightbox.url_full))
                          setMenuOpen(false)
                          showNotification('Link copied to clipboard')
                        } catch { /* clipboard not supported */ }
                      }}
                    >
                      🔗 Copy Link
                    </button>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
