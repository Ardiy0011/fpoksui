import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { io as socketIo } from 'socket.io-client'
import wreathImg from '../assets/wreath.png'
import './LiveSharePage.css'

type MediaType = 'image' | 'video'

type GalleryItem = {
  id: string
  type: MediaType
  url_thumb: string
  url_medium: string
  url_full: string
  created_at: string
}

type SessionInfo = {
  token: string
  title: string
  uploadLimit: number
  isActive: boolean
}

type PendingFile = {
  id: string
  file: File
  previewUrl: string
  type: MediaType
}

type QuotaResponse = {
  limit: number
  used: { images: number; videos: number }
  remaining: { images: number; videos: number }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? '/backend' : 'http://localhost:4000')
const DEFAULT_UPLOAD_LIMIT = 5
const PAGE_SIZE = 15

function resolveUrl(url: string) {
  if (url.startsWith('/uploads') || url.startsWith('/api')) {
    return `${API_BASE_URL}${url}`
  }
  return url
}

function getGuestId(token: string) {
  const key = `finpok_guest_${token}`
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const newId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  localStorage.setItem(key, newId)
  return newId
}

export default function LiveSharePage() {
  const { token = '' } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [guestId, setGuestId] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [quota, setQuota] = useState<QuotaResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const notifyTimer = useRef<number>(0)
  const [showSplash, setShowSplash] = useState(true)

  // Gallery state
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [filter, setFilter] = useState<'all' | 'image' | 'video'>('all')

  // Lightbox state
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const sentinelRef = useRef<HTMLDivElement>(null)

  const defaultSession: SessionInfo = {
    token: token || 'live-share',
    title: 'FiiFii & Pokuah',
    uploadLimit: DEFAULT_UPLOAD_LIMIT,
    isActive: true,
  }

  const uploadLimit = quota?.limit ?? session?.uploadLimit ?? DEFAULT_UPLOAD_LIMIT

  // ── Notifications ──
  function showNotification(msg: string) {
    window.clearTimeout(notifyTimer.current)
    setNotification(null)
    requestAnimationFrame(() => {
      setNotification(msg)
      notifyTimer.current = window.setTimeout(() => setNotification(null), 3200)
    })
  }
  useEffect(() => () => window.clearTimeout(notifyTimer.current), [])

  // ── Load gallery page ──
  const loadGalleryPage = useCallback(async (cursor?: string) => {
    if (!token) return
    const url = `${API_BASE_URL}/api/gallery/${encodeURIComponent(token)}?limit=${PAGE_SIZE}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json() as { items: GalleryItem[]; nextCursor: string | null; total?: number }
    if (cursor) {
      setGalleryItems((prev) => [...prev, ...data.items])
    } else {
      setGalleryItems(data.items)
    }
    setNextCursor(data.nextCursor)
    if (data.total !== undefined) setTotalCount(data.total)
  }, [token])

  // ── Load count ──
  const loadCount = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE_URL}/api/gallery/${encodeURIComponent(token)}/count`)
      if (res.ok) {
        const data = await res.json() as { count: number }
        setTotalCount(data.count)
      }
    } catch { /* silent */ }
  }, [token])

  // ── Initial load ──
  useEffect(() => {
    if (!token) {
      setSession(defaultSession)
      setLoading(false)
      return
    }

    const generatedGuestId = getGuestId(token)
    setGuestId(generatedGuestId)

    async function init() {
      try {
        const vRes = await fetch(`${API_BASE_URL}/api/sessions/${encodeURIComponent(token)}/validate`)
        if (vRes.ok) {
          const vPayload = await vRes.json() as { session: SessionInfo }
          setSession(vPayload.session)
        } else {
          setSession(defaultSession)
        }
      } catch {
        setSession(defaultSession)
      }

      try {
        const qRes = await fetch(
          `${API_BASE_URL}/api/live/${encodeURIComponent(token)}/quota?guestId=${encodeURIComponent(generatedGuestId)}`,
        )
        if (qRes.ok) {
          const qPayload = await qRes.json() as QuotaResponse & { ok: boolean }
          setQuota(qPayload)
        }
      } catch { /* silent */ }

      try {
        await loadGalleryPage()
        await loadCount()
      } catch { /* gallery data is non-critical */ }

      setLoading(false)
    }

    void init()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Socket.io for real-time updates ──
  useEffect(() => {
    if (!token) return

    const socket = socketIo(API_BASE_URL, { transports: ['websocket', 'polling'] })
    socket.on('connect', () => socket.emit('join:session', token))

    socket.on('media:new', () => {
      void loadGalleryPage()
      void loadCount()
      showNotification('A guest just shared a photo ✨')
    })

    socket.on('media:deleted', () => {
      void loadGalleryPage()
      void loadCount()
    })

    return () => { socket.disconnect() }
  }, [token, loadGalleryPage, loadCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Infinite scroll observer ──
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && nextCursor && !loadingMore) {
          setLoadingMore(true)
          loadGalleryPage(nextCursor).finally(() => setLoadingMore(false))
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [nextCursor, loadingMore, loadGalleryPage])

  // ── Cleanup pending file URLs ──
  useEffect(() => {
    return () => { pendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl)) }
  }, [pendingFiles])

  // ── Upload helpers ──
  async function refreshAfterUpload() {
    if (!token || !guestId) return
    try {
      const qRes = await fetch(
        `${API_BASE_URL}/api/live/${encodeURIComponent(token)}/quota?guestId=${encodeURIComponent(guestId)}`,
      )
      if (qRes.ok) {
        const payload = await qRes.json() as QuotaResponse & { ok: boolean }
        setQuota(payload)
      }
    } catch { /* silent */ }
    await loadGalleryPage()
    await loadCount()
  }

  async function uploadSingleFile(pending: PendingFile) {
    if (!token || !guestId) return false
    setErrorMessage('')
    try {
      let fileToUpload: File | Blob = pending.file
      if (pending.type === 'image') {
        fileToUpload = await imageCompression(pending.file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
        })
      }
      const formData = new FormData()
      formData.append('file', fileToUpload, pending.file.name)
      formData.append('guestId', guestId)
      const response = await fetch(`${API_BASE_URL}/api/live/${encodeURIComponent(token)}/upload`, {
        method: 'POST',
        body: formData,
      })
      const payload = await response.json() as { ok: boolean; message?: string }
      if (!response.ok) throw new Error(payload.message || 'Upload failed. Please try again.')
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.'
      setErrorMessage(message)
      return false
    }
  }

  function inferMediaType(file: File): MediaType | null {
    if (file.type.startsWith('image/')) return 'image'
    if (file.type.startsWith('video/')) return 'video'
    return null
  }

  function appendPendingFiles(fileList: FileList | null) {
    if (!fileList) return
    const mapped = Array.from(fileList)
      .map((file) => {
        const mediaType = inferMediaType(file)
        if (!mediaType) return null
        return {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          type: mediaType,
        } as PendingFile
      })
      .filter((item): item is PendingFile => Boolean(item))

    if (mapped.length === 0) {
      setErrorMessage('Only image or video files are supported.')
      return
    }
    setErrorMessage('')
    setPendingFiles((prev) => [...prev, ...mapped])
  }

  function removePendingFile(id: string) {
    setPendingFiles((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  async function handleSaveUploads() {
    if (!token || !guestId || pendingFiles.length === 0 || isSaving) return
    setErrorMessage('')
    setIsSaving(true)
    let completed = 0
    try {
      for (const pending of pendingFiles) {
        const ok = await uploadSingleFile(pending)
        if (!ok) break
        completed += 1
      }
      pendingFiles.slice(0, completed).forEach((item) => URL.revokeObjectURL(item.previewUrl))
      setPendingFiles((prev) => prev.slice(completed))
      if (completed === pendingFiles.length) {
        setShowUploadModal(false)
        showNotification('Photos uploaded successfully ✨')
      }
    } catch {
      setErrorMessage('Some items were not saved yet. Please try again.')
    } finally {
      setIsSaving(false)
      await refreshAfterUpload()
    }
  }

  const quotaSummary = useMemo(() => {
    if (!quota) return null
    return { used: quota.used.images + quota.used.videos, limit: quota.limit }
  }, [quota])

  const filtered = filter === 'all' ? galleryItems : galleryItems.filter((i) => i.type === filter)

  // Auto-dismiss splash after data loads (min 2.5s for the animation)
  useEffect(() => {
    if (loading) return
    const timer = window.setTimeout(() => setShowSplash(false), 2500)
    return () => window.clearTimeout(timer)
  }, [loading])

  const hasFiles = pendingFiles.length > 0

  return (
    <>
      {showSplash && (
        <section className="live-splash" aria-label="Loading live gallery">
          <div className="live-splash-content">
            <div className="splash-wreath" aria-hidden="true">
              <img className="wreath-image" src={wreathImg} alt="" />
              <div className="splash-initials">
                <span className="glyph glyph-f">F</span>
                <span className="glyph glyph-amp">&amp;</span>
                <span className="glyph glyph-p">P</span>
              </div>
            </div>
            <p className="splash-title">FiiFii &amp; Pokuah</p>
            <p className="splash-subtitle">Live Gallery</p>
          </div>
        </section>
      )}

    <main className="live-page">
      {notification && (
        <div className="gallery-notification" key={notification}>
          {notification}
        </div>
      )}

      {/* Compact Header */}
      <header className="live-bar">
        <Link to="/" className="live-bar-back" aria-label="Back to home">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        <div className="live-bar-center">
          <h1 className="live-bar-title">{session?.title || defaultSession.title}</h1>
          {totalCount > 0 && (
            <span className="live-bar-count">
              <span className="live-bar-dot" />
              {totalCount} {totalCount === 1 ? 'moment' : 'moments'}
            </span>
          )}
        </div>

        <button
          type="button"
          className="live-bar-share"
          onClick={() => setShowUploadModal(true)}
          aria-label="Share a moment"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </header>

      {/* Filters */}
      <div className="gallery-filters">
        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
        <button className={`filter-chip ${filter === 'image' ? 'active' : ''}`} onClick={() => setFilter('image')}>Photos</button>
        <button className={`filter-chip ${filter === 'video' ? 'active' : ''}`} onClick={() => setFilter('video')}>Videos</button>
        <span className="filter-count">{filtered.length} items</span>
      </div>

      {/* Empty State */}
      {filtered.length === 0 && !loading && (
        <div className="live-empty">
          <div className="empty-illustration" aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <rect x="10" y="18" width="44" height="34" rx="6" stroke="currentColor" strokeWidth="1.2" opacity="0.3" />
              <circle cx="24" cy="30" r="5" stroke="currentColor" strokeWidth="1" opacity="0.25" />
              <path d="M10 44l12-9 8 6 10-8 14 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.2" />
              <rect x="26" y="28" width="44" height="34" rx="6" stroke="currentColor" strokeWidth="1.2" opacity="0.2" />
              <path d="M56 20l3-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
              <path d="M62 24l4-1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
              <path d="M58 28l2 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.15" />
            </svg>
          </div>
          <p className="empty-title">No moments yet</p>
          <p className="empty-desc">Be the first to capture and share a special memory</p>
          <button type="button" className="live-empty-cta" onClick={() => setShowUploadModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ marginRight: '6px', verticalAlign: '-2px' }}>
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            Share a Moment
          </button>
        </div>
      )}

      {/* Gallery Grid */}
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

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="scroll-sentinel">
        {loadingMore && <div className="loader-ring loader-ring--small" />}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="upload-modal-overlay" onClick={() => { if (!isSaving) setShowUploadModal(false) }}>
          <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="upload-modal-close"
              onClick={() => { if (!isSaving) setShowUploadModal(false) }}
            >✕</button>

            {/* Illustration hero area */}
            <div className="upload-hero">
              <div className="upload-hero-icons">
                <svg className="hero-icon hero-icon--camera" width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <rect x="4" y="12" width="40" height="28" rx="6" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="24" cy="26" r="8" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="24" cy="26" r="4" fill="currentColor" opacity="0.15" />
                  <path d="M16 12l2-4h12l2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="36" cy="18" r="2" fill="currentColor" opacity="0.4" />
                </svg>
                <svg className="hero-icon hero-icon--heart" width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s-7-4.35-7-10a5 5 0 0 1 9.9-1h.1A5 5 0 0 1 19 11c0 5.65-7 10-7 10z" fill="currentColor" opacity="0.25" stroke="currentColor" strokeWidth="1" />
                </svg>
                <svg className="hero-icon hero-icon--sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor" opacity="0.35" />
                </svg>
                <svg className="hero-icon hero-icon--photo" width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <rect x="3" y="6" width="30" height="24" rx="4" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="12" cy="15" r="3" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M3 24l8-6 5 4 6-5 11 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <h2 className="upload-hero-title">Share Your Moments</h2>
              <p className="upload-hero-subtitle">Capture the magic — every photo tells a story</p>

              {quotaSummary && (
                <div className="quota-pill" role="status">
                  <span className="quota-pill-dot" />
                  <span>{quotaSummary.used} of {quotaSummary.limit} shared</span>
                </div>
              )}
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="dropzone-input"
              onChange={(event) => { appendPendingFiles(event.target.files); event.target.value = '' }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="dropzone-input"
              onChange={(event) => { appendPendingFiles(event.target.files); event.target.value = '' }}
            />

            {/* Action cards */}
            <div className="upload-actions">
              <button
                type="button"
                className="upload-action-card"
                onClick={() => cameraInputRef.current?.click()}
              >
                <div className="action-card-icon">
                  <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                    <rect x="6" y="14" width="36" height="24" rx="5" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="24" cy="26" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="24" cy="26" r="3" fill="currentColor" opacity="0.2" />
                    <path d="M17 14l2-4h10l2 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="action-card-title">Take a Photo</span>
                <span className="action-card-desc">Open your camera</span>
              </button>

              <button
                type="button"
                className="upload-action-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="action-card-icon">
                  <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                    <rect x="4" y="8" width="28" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" />
                    <rect x="16" y="18" width="28" height="22" rx="4" stroke="currentColor" strokeWidth="1.5" fill="var(--surface, #1a1a1a)" />
                    <circle cx="24" cy="24" r="3" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M16 34l6-5 4 3 5-4 13 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className="action-card-title">From Gallery</span>
                <span className="action-card-desc">Choose photos &amp; videos</span>
              </button>
            </div>

            <p className="upload-limit-hint">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
                <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" fill="currentColor" opacity="0.5" />
              </svg>
              Up to {uploadLimit} photos &amp; videos
            </p>

            {hasFiles && (
              <section className="pending-grid" aria-label="Selected files">
                {pendingFiles.map((item) => (
                  <div key={item.id} className="pending-card">
                    <div className="pending-thumb">
                      {item.type === 'image' ? (
                        <img src={item.previewUrl} alt="" />
                      ) : (
                        <video src={item.previewUrl} muted preload="metadata" />
                      )}
                      <button
                        type="button"
                        className="pending-remove"
                        onClick={() => removePendingFile(item.id)}
                        aria-label={`Remove ${item.file.name}`}
                      >×</button>
                      <span className="pending-type">{item.type === 'video' ? '▶' : ''}</span>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {hasFiles && (
              <button
                type="button"
                className="upload-btn"
                onClick={handleSaveUploads}
                disabled={isSaving}
              >
                {isSaving ? (
                  <span className="upload-btn-spinner" />
                ) : (
                  `Upload ${pendingFiles.length} ${pendingFiles.length === 1 ? 'file' : 'files'}`
                )}
              </button>
            )}

            {errorMessage && <p className="live-toast live-toast--error">{errorMessage}</p>}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" onClick={() => { setLightbox(null); setMenuOpen(false) }} role="dialog">
          <button className="lightbox-close" onClick={() => { setLightbox(null); setMenuOpen(false) }}>✕</button>

          {(() => {
            const idx = filtered.findIndex((i) => i.id === lightbox.id)
            return (
              <>
                {idx > 0 && (
                  <button
                    className="lightbox-arrow lightbox-arrow--prev"
                    onClick={(e) => { e.stopPropagation(); setLightbox(filtered[idx - 1]); setMenuOpen(false) }}
                    aria-label="Previous"
                  >‹</button>
                )}
                {idx < filtered.length - 1 && (
                  <button
                    className="lightbox-arrow lightbox-arrow--next"
                    onClick={(e) => { e.stopPropagation(); setLightbox(filtered[idx + 1]); setMenuOpen(false) }}
                    aria-label="Next"
                  >›</button>
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
                className="lightbox-action-btn"
                title="Open full size"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >↓</a>
              <button
                type="button"
                className="lightbox-action-btn"
                title="More options"
                onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v) }}
              >
                ⋯
                {menuOpen && (
                  <div className="lightbox-menu" onClick={(e) => e.stopPropagation()}>
                    <a href={resolveUrl(lightbox.url_full)} className="lightbox-menu-item" target="_blank" rel="noopener noreferrer">
                      🔎 Open Full Size
                    </a>
                    <a href={resolveUrl(lightbox.url_medium)} className="lightbox-menu-item" target="_blank" rel="noopener noreferrer">
                      📱 Open Medium
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
                    >🔗 Copy Link</button>
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
    </>
  )
}
