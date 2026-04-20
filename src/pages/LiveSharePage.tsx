import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import imageCompression from 'browser-image-compression'
import { io as socketIo } from 'socket.io-client'
import './LiveSharePage.css'

type MediaType = 'image' | 'video'

type UploadItem = {
  id: string
  original_name: string
  type: MediaType
  url_thumb: string
  url_medium: string
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
  used: {
    images: number
    videos: number
  }
  remaining: {
    images: number
    videos: number
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'
const DEFAULT_UPLOAD_LIMIT = 5

function getGuestId(token: string) {
  const key = `finpok_guest_${token}`
  const existing = localStorage.getItem(key)

  if (existing) {
    return existing
  }

  const newId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  localStorage.setItem(key, newId)
  return newId
}

export default function LiveSharePage() {
  const { token = '' } = useParams()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [guestId, setGuestId] = useState('')
  const [session, setSession] = useState<SessionInfo | null>(null)
  const [quota, setQuota] = useState<QuotaResponse | null>(null)
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [statusMessage, setStatusMessage] = useState('Preparing live share...')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const defaultSession: SessionInfo = {
    token: token || 'live-share',
    title: 'FiiFii & Pokuah',
    uploadLimit: DEFAULT_UPLOAD_LIMIT,
    isActive: true,
  }

  const uploadLimit = quota?.limit ?? session?.uploadLimit ?? DEFAULT_UPLOAD_LIMIT

  // ── Socket.io for real-time updates ──
  useEffect(() => {
    if (!token) return

    const socket = socketIo(API_BASE_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      socket.emit('join:session', token)
    })

    socket.on('media:new', () => {
      // Refresh uploads when someone (including us) adds media
      void reloadLiveState()
    })

    socket.on('media:deleted', () => {
      void reloadLiveState()
    })

    return () => { socket.disconnect() }
  }, [token, guestId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!token) {
      setSession(defaultSession)
      setStatusMessage('Live page is ready. Select files to upload.')
      setLoading(false)
      return
    }

    const generatedGuestId = getGuestId(token)
    setGuestId(generatedGuestId)

    async function loadInitialData() {
      try {
        const validationResponse = await fetch(`${API_BASE_URL}/api/sessions/${token}/validate`)

        if (!validationResponse.ok) {
          throw new Error('Live link currently syncing.')
        }

        const validationPayload = (await validationResponse.json()) as {
          session: SessionInfo
        }
        setSession(validationPayload.session)

        await Promise.all([refreshQuota(generatedGuestId), refreshUploads(generatedGuestId)])
        setStatusMessage('You can now select your photos or videos.')
      } catch (error) {
        setSession(defaultSession)
        setStatusMessage('You can still prepare uploads. We will try to connect when you save.')
      } finally {
        setLoading(false)
      }
    }

    async function refreshQuota(currentGuestId: string) {
      const response = await fetch(
        `${API_BASE_URL}/api/live/${token}/quota?guestId=${encodeURIComponent(currentGuestId)}`,
      )

      if (!response.ok) {
        throw new Error('Upload limits are syncing. You can still prepare files.')
      }

      const payload = (await response.json()) as QuotaResponse & { ok: boolean }
      setQuota(payload)
    }

    async function refreshUploads(currentGuestId: string) {
      const response = await fetch(
        `${API_BASE_URL}/api/live/${token}/uploads?guestId=${encodeURIComponent(currentGuestId)}`,
      )

      if (!response.ok) {
        throw new Error('Your upload list is syncing. Please continue.')
      }

      const payload = (await response.json()) as { items: UploadItem[] }
      setUploads(payload.items)
    }

    void loadInitialData()
  }, [token])

  async function reloadLiveState() {
    if (!token || !guestId) {
      return
    }

    const [quotaResponse, uploadsResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/live/${token}/quota?guestId=${encodeURIComponent(guestId)}`),
      fetch(`${API_BASE_URL}/api/live/${token}/uploads?guestId=${encodeURIComponent(guestId)}`),
    ])

    if (!quotaResponse.ok || !uploadsResponse.ok) {
      setStatusMessage('Saved, but live totals could not refresh right now.')
      return
    }

    const quotaPayload = (await quotaResponse.json()) as QuotaResponse & { ok: boolean }
    const uploadsPayload = (await uploadsResponse.json()) as { items: UploadItem[] }

    setQuota(quotaPayload)
    setUploads(uploadsPayload.items)
  }

  useEffect(() => {
    return () => {
      pendingFiles.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
      })
    }
  }, [pendingFiles])

  async function uploadSingleFile(pending: PendingFile) {
    if (!token || !guestId) return false

    setErrorMessage('')

    try {
      // Compress images client-side before sending
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

      const response = await fetch(`${API_BASE_URL}/api/live/${token}/upload`, {
        method: 'POST',
        body: formData,
      })

      const payload = (await response.json()) as { ok: boolean; message?: string }

      if (!response.ok) {
        throw new Error(payload.message || 'Upload failed. Please try again.')
      }

      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed. Please try again.'
      setErrorMessage(message)
      return false
    }
  }

  function inferMediaType(file: File): MediaType | null {
    if (file.type.startsWith('image/')) {
      return 'image'
    }

    if (file.type.startsWith('video/')) {
      return 'video'
    }

    return null
  }

  function appendPendingFiles(fileList: FileList | null) {
    if (!fileList) {
      return
    }

    const mapped = Array.from(fileList)
      .map((file) => {
        const mediaType = inferMediaType(file)

        if (!mediaType) {
          return null
        }

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
      if (target) {
        URL.revokeObjectURL(target.previewUrl)
      }

      return prev.filter((item) => item.id !== id)
    })
  }

  async function handleSaveUploads() {
    if (!token || !guestId || pendingFiles.length === 0 || isSaving) {
      return
    }

    setErrorMessage('')
    setIsSaving(true)

    let completed = 0

    try {
      for (const pending of pendingFiles) {
        const ok = await uploadSingleFile(pending)
        if (!ok) {
          break
        }
        completed += 1
      }

      pendingFiles.slice(0, completed).forEach((item) => {
        URL.revokeObjectURL(item.previewUrl)
      })
      setPendingFiles((prev) => prev.slice(completed))

      if (completed === pendingFiles.length) {
        setStatusMessage('Saved successfully. Your media has been added.')
      }
    } catch {
      setErrorMessage('Some items were not saved yet. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(uploadId: string) {
    if (!token || !guestId) {
      return
    }

    setErrorMessage('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/live/${token}/upload/${uploadId}?guestId=${encodeURIComponent(guestId)}`,
        { method: 'DELETE' },
      )

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string }
        throw new Error(payload.message || 'Delete failed')
      }

      setStatusMessage('Deleted. You can now upload another one.')
      await reloadLiveState()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Delete failed.'
      setErrorMessage(message)
    }
  }

  const quotaSummary = useMemo(() => {
    if (!quota) {
      return null
    }

    const totalUsed = quota.used.images + quota.used.videos
    return { used: totalUsed, limit: quota.limit }
  }, [quota])

  const uploadInstruction = useMemo(() => {
    return `Up to ${uploadLimit} photos & videos`
  }, [uploadLimit])

  if (loading) {
    return (
      <main className="live-page">
        <div className="live-loader">
          <div className="loader-ring" />
        </div>
      </main>
    )
  }

  const hasFiles = pendingFiles.length > 0
  const totalUploaded = uploads.length

  return (
    <main className="live-page">
      {/* Header */}
      <header className="live-header">
        <Link to="/" className="live-back" aria-label="Back to home">
          ← Home
        </Link>
        <div className="live-title-group">
          <h1 className="live-title">{session?.title || defaultSession.title}</h1>
          <p className="live-subtitle">Live Gallery</p>
        </div>
      </header>

      {/* Quota Badge */}
      {quotaSummary && (
        <div className="quota-badge" role="status">
          <span className="quota-count">{quotaSummary.used}</span>
          <span className="quota-sep">/</span>
          <span className="quota-limit">{quotaSummary.limit}</span>
          <span className="quota-label">uploaded</span>
        </div>
      )}

      {/* Dropzone — always visible */}
      <div
        className={`dropzone ${isDragOver ? 'dropzone--over' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragOver(false)
          appendPendingFiles(event.dataTransfer.files)
        }}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="dropzone-input"
          onChange={(event) => {
            appendPendingFiles(event.target.files)
            event.target.value = ''
          }}
        />

        <div className="dropzone-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="23" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
            <path d="M24 16v16M16 24h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
        <p className="dropzone-hint">Tap or drop photos & videos</p>
        <p className="dropzone-limit">{uploadInstruction}</p>
      </div>

      {/* Pending Files Grid — only when files selected */}
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
                >
                  ×
                </button>
                <span className="pending-type">{item.type === 'video' ? '▶' : ''}</span>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Upload Button */}
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

      {/* Status / Errors */}
      {errorMessage && <p className="live-toast live-toast--error">{errorMessage}</p>}
      {!errorMessage && statusMessage && !loading && (
        <p className="live-toast">{statusMessage}</p>
      )}

      {/* Previous Uploads — thumbnail grid */}
      {totalUploaded > 0 && (
        <section className="uploaded-section">
          <h2 className="uploaded-heading">Your Uploads</h2>
          <div className="uploaded-thumb-grid">
            {uploads.map((item) => (
              <div key={item.id} className="uploaded-thumb-card">
                {item.url_thumb ? (
                  item.type === 'image' ? (
                    <img src={item.url_thumb.startsWith('/') ? `${API_BASE_URL}${item.url_thumb}` : item.url_thumb} alt="" />
                  ) : (
                    <video src={item.url_medium.startsWith('/') ? `${API_BASE_URL}${item.url_medium}` : item.url_medium} muted preload="metadata" />
                  )
                ) : (
                  <span className="uploaded-placeholder">{item.type === 'image' ? '📷' : '🎥'}</span>
                )}
                <button
                  type="button"
                  className="uploaded-thumb-delete"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Delete ${item.original_name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
