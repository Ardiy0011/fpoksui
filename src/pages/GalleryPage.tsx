import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
import bg1 from '../assets/bg1.jpg'
import bg2 from '../assets/bg2.jpg'
import fipoksEngagementVid from '../assets/vids/fipoksengagementvid.mp4'

type GalleryItem = {
  id: string
  type: 'image' | 'video'
  url_thumb: string
  url_medium: string
  url_full: string
  created_at: string
}

/* Dummy images from Journey folder shown when the real gallery is empty */
const DUMMY_ITEMS: GalleryItem[] = [
  { id: 'fv1', type: 'video', url_thumb: fipoksEngagementVid, url_medium: fipoksEngagementVid, url_full: fipoksEngagementVid, created_at: '2026-04-25T09:55:00Z' },
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
  { id: 'd11', type: 'image', url_thumb: bg1, url_medium: bg1, url_full: bg1, created_at: '2026-04-25T10:50:00Z' },
  { id: 'd12', type: 'image', url_thumb: bg2, url_medium: bg2, url_full: bg2, created_at: '2026-04-25T10:55:00Z' }
]


export default function GalleryPage() {
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')
  const [menuOpen, setMenuOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const notifyTimer = useRef<number>(0)

  function showNotification(msg: string) {
    window.clearTimeout(notifyTimer.current)
    setNotification(null)
    requestAnimationFrame(() => {
      setNotification(msg)
      notifyTimer.current = window.setTimeout(() => setNotification(null), 3200)
    })
  }

  const displayItems = DUMMY_ITEMS
  const filtered = filter === 'all' ? displayItems : displayItems.filter((i) => i.type === filter)

  return (
    <main className="gallery-page">
      {notification && (
        <div className="gallery-notification" key={notification}>
          {notification}
        </div>
      )}

      <header className="gallery-bar">
        <Link to="/" className="gallery-bar-back" aria-label="Back to home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </Link>
        <div className="gallery-bar-center">
          <h1 className="gallery-bar-title">Couples Gallery</h1>
          <span className="gallery-bar-count">{filtered.length} photos</span>
        </div>
        <div style={{ width: 34 }} />
      </header>

      <div className="gallery-filters">
        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-chip ${filter === 'image' ? 'active' : ''}`} onClick={() => setFilter('image')}>Photos</button>
        <button className={`filter-chip ${filter === 'video' ? 'active' : ''}`} onClick={() => setFilter('video')}>Videos</button>
      </div>

      <div className="gallery-grid">
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`gallery-card ${filter === 'all' && item.id === 'fv1' ? 'gallery-card--featured-video' : ''}`}
            onClick={() => { setLightbox(item); setMenuOpen(false) }}
            role="button"
            tabIndex={0}
          >
            {item.type === 'image' ? (
              <img src={item.url_thumb} alt="" loading="lazy" />
            ) : (
              <div className="gallery-video-thumb">
                <video src={item.url_thumb} muted autoPlay loop playsInline preload="metadata" />
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
              <img src={lightbox.url_full} alt="" />
            ) : (
              <video src={lightbox.url_full} controls autoPlay loop playsInline />
            )}
            <div className="lightbox-actions">
              <a
                href={lightbox.url_full}
                className="lightbox-action-btn"
                title="Open full size"
                target="_blank"
                rel="noopener noreferrer"
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
                      href={lightbox.url_full}
                      className="lightbox-menu-item"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      🔎 Open Full Size
                    </a>
                    <a
                      href={lightbox.url_medium}
                      className="lightbox-menu-item"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      📱 Open Medium
                    </a>
                    <button
                      type="button"
                      className="lightbox-menu-item"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(lightbox.url_full)
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
