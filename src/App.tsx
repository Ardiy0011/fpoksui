import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import heroVid from './assets/vids/vidimg3.mp4'
import wreathImg from './assets/wreath.png'
import journeyImg1 from './assets/Journeyimages/photo_2026-04-20_11-49-20.jpg'
import journeyImg2 from './assets/Journeyimages/photo_2026-04-20_11-49-23.jpg'
import journeyImg3 from './assets/Journeyimages/photo_2026-04-20_11-49-25.jpg'
import journeyImg4 from './assets/Journeyimages/photo_2026-04-20_11-49-28.jpg'
import journeyImg5 from './assets/Journeyimages/photo_2026-04-20_11-49-31.jpg'
import journeyImg6 from './assets/Journeyimages/photo_2026-04-20_11-49-33.jpg'
import journeyImg7 from './assets/Journeyimages/photo_2026-04-20_11-49-36.jpg'
import journeyImg9 from './assets/Journeyimages/photo_2026-04-20_11-49-48.jpg'
import journeyImg10 from './assets/Journeyimages/photo_2026-04-20_11-49-51.jpg'
import './App.css'

const WEDDING_DATE = '2026-04-25T10:00:00+00:00'
const SPLASH_SEEN_KEY = 'extensionSeen'

type VenueInfo = {
  title: string
  time: string
  venue: string
  address: string
  mapEmbedUrl: string
  directionsUrl: string
}

type EventDetails = {
  couple: string
  date: string
  city: string
  ceremony: VenueInfo
  reception: VenueInfo
}

const FALLBACK_EVENT: EventDetails = {
  couple: 'FiiFii & Pokuah',
  date: WEDDING_DATE,
  city: 'Accra',
  ceremony: {
    title: 'Holy Matrimony',
    time: '1:00 PM',
    venue: 'Presbyterian Church of Ghana, Hope Congregation',
    address: 'Accra',
    mapEmbedUrl:
      'https://www.google.com/maps?q=Presbyterian+Church+of+Ghana+Hope+Congregation+Accra&output=embed',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=Presbyterian+Church+of+Ghana+Hope+Congregation+Accra',
  },
  reception: {
    title: 'Wedding Reception',
    time: '',
    venue: 'Fountain Head Christian School',
    address: 'Accra',
    mapEmbedUrl:
      'https://www.google.com/maps?q=Fountain+Head+Christian+School+Accra&output=embed',
    directionsUrl:
      'https://www.google.com/maps/dir/?api=1&destination=Fountain+Head+Christian+School+Accra',
  },
}

type CountdownState = {
  days: number
  hours: number
  minutes: number
  seconds: number
  complete: boolean
}

function getCountdown(targetIso: string): CountdownState {
  const target = new Date(targetIso).getTime()
  const now = Date.now()
  const diff = Math.max(0, target - now)

  if (diff === 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, complete: true }
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    complete: false,
  }
}

type FlipUnitProps = {
  value: number
  label: string
}

function FlipUnit({ value, label }: FlipUnitProps) {
  const [prev, setPrev] = useState(value)
  const [cur, setCur] = useState(value)
  const [flipping, setFlipping] = useState(false)

  useEffect(() => {
    if (value === cur) return

    setPrev(cur)
    setCur(value)
    setFlipping(true)

    const id = window.setTimeout(() => setFlipping(false), 600)
    return () => window.clearTimeout(id)
  }, [value, cur])

  const p = String(prev).padStart(2, '0')
  const c = String(cur).padStart(2, '0')

  return (
    <div className="flip-unit">
      <div className="flip-clock" aria-hidden="true">
        {/* Static top half — always shows NEW value */}
        <div className="flip-top">
          <span>{c}</span>
        </div>
        {/* Static bottom half — shows OLD until flip ends, then NEW */}
        <div className="flip-bottom">
          <span>{flipping ? p : c}</span>
        </div>
        {/* Center divider line */}
        <div className="flip-divider" />
        {/* Animated flap — top half folds down */}
        {flipping && (
          <div className="flip-flap flip-flap--front" key={`f-${p}`}>
            <span>{p}</span>
          </div>
        )}
        {flipping && (
          <div className="flip-flap flip-flap--back" key={`b-${c}`}>
            <span>{c}</span>
          </div>
        )}
      </div>
      <span className="flip-label">{label}</span>
    </div>
  )
}

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const eventDetails = FALLBACK_EVENT
  const [countdown, setCountdown] = useState<CountdownState>(() =>
    getCountdown(FALLBACK_EVENT.date),
  )
  const [journeyLightbox, setJourneyLightbox] = useState<string | null>(null)
  const heroVideoRef = useRef<HTMLVideoElement>(null)
  const videoReady = useRef(false)

  useEffect(() => {
    let splashDuration = 7000

    try {
      const hasSeenSplash = window.localStorage.getItem(SPLASH_SEEN_KEY) === 'true'
      if (!hasSeenSplash) {
        splashDuration = 9000
        window.localStorage.setItem(SPLASH_SEEN_KEY, 'true')
      }
    } catch {
      splashDuration = 9000
    }

    const splashTimer = window.setTimeout(() => {
      setShowSplash(false)
    }, splashDuration)

    return () => window.clearTimeout(splashTimer)
  }, [])

  // Start hero video only after splash is gone AND video is ready
  useEffect(() => {
    const vid = heroVideoRef.current
    if (!vid || showSplash) return

    function tryPlay() {
      if (!vid) return
      vid.play().catch(() => {
        // Video not ready yet — retry shortly
        window.setTimeout(tryPlay, 200)
      })
    }

    if (videoReady.current || vid.readyState >= 3) {
      tryPlay()
    } else {
      // Wait for the video to be loadable, then play
      const onReady = () => {
        videoReady.current = true
        tryPlay()
      }
      vid.addEventListener('canplay', onReady, { once: true })
      // Also force a load in case browser stalled
      vid.load()
      return () => vid.removeEventListener('canplay', onReady)
    }
  }, [showSplash])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown(getCountdown(eventDetails.date))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [eventDetails.date])

  const countdownItems = useMemo(
    () => [
      { label: 'Days', value: countdown.days },
      { label: 'Hours', value: countdown.hours },
      { label: 'Minutes', value: countdown.minutes },
      { label: 'Seconds', value: countdown.seconds },
    ],
    [countdown],
  )

  /* ── Scroll reveal observer ── */
  const revealRefs = useRef<(HTMLElement | null)[]>([])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 },
    )
    revealRefs.current.forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [showSplash])

  function revealRef(el: HTMLElement | null) {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el)
    }
  }

  function handleExploreDetailsClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()

    const target = document.getElementById('details')
    if (!target) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      target.scrollIntoView({ behavior: 'auto', block: 'start' })
      return
    }

    const startY = window.scrollY
    const targetY = target.getBoundingClientRect().top + window.scrollY
    const duration = 7000
    const startTime = performance.now()

    const easeInOutQuad = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2

    const step = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = easeInOutQuad(progress)
      window.scrollTo(0, startY + (targetY - startY) * eased)

      if (progress < 1) {
        window.requestAnimationFrame(step)
      }
    }

    window.requestAnimationFrame(step)
  }

  return (
    <>
      {showSplash && (
        <section className="splash-screen" aria-label="Loading wedding welcome">
          {/* Envelope flap — triangular top that lifts open */}
          <div className="envelope-flap" aria-hidden="true" />
          {/* Envelope lining visible behind the flap */}
          <div className="envelope-lining" aria-hidden="true" />

          {/* Wreath seal + initials + text */}
          <div className="envelope-content">
            <div className="splash-wreath" aria-hidden="true">
              <img className="wreath-image" src={wreathImg} alt="" />
              <div className="splash-initials">
                <span className="glyph glyph-f">F</span>
                <span className="glyph glyph-amp">&amp;</span>
                <span className="glyph glyph-p">P</span>
              </div>
            </div>
            <p className="splash-title">FiiFii &amp; Pokuah</p>
            <p className="splash-twi">Aware fofro te se ode</p>
          </div>
        </section>
      )}

      <main className="wedding-page">
        <section className="hero-photo" aria-label="Couple hero video">
          <video
            ref={heroVideoRef}
            className="hero-image"
            src={heroVid}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onCanPlay={() => { videoReady.current = true }}
          />
          <div className="hero-overlay hero-animate">
            {/* Shared SVG gradient definition */}
            <svg style={{ position: 'absolute', width: 0, height: 0 }} aria-hidden="true">
              <defs>
                <linearGradient id="gold-leaf-gradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c9a84c" />
                  <stop offset="40%" stopColor="#a8893d" />
                  <stop offset="100%" stopColor="#5c4415" />
                </linearGradient>
              </defs>
            </svg>
            {/* Gold floating leaves */}
            <svg className="hero-leaf leaf-2" viewBox="0 0 32 32" aria-hidden="true"><path d="M26 4c-4 2-10 7-14 14-2 4-3.5 8-4 10 .5-.2 3-1.5 6-4 4-3.2 8-8 10-14 .8-2.2 1.5-4.2 2-6z"/></svg>
            <svg className="hero-leaf leaf-3" viewBox="0 0 32 32" aria-hidden="true"><path d="M26 4c-4 2-10 7-14 14-2 4-3.5 8-4 10 .5-.2 3-1.5 6-4 4-3.2 8-8 10-14 .8-2.2 1.5-4.2 2-6z"/></svg>
            <svg className="hero-leaf leaf-4" viewBox="0 0 32 32" aria-hidden="true"><path d="M26 4c-4 2-10 7-14 14-2 4-3.5 8-4 10 .5-.2 3-1.5 6-4 4-3.2 8-8 10-14 .8-2.2 1.5-4.2 2-6z"/></svg>
            <svg className="hero-leaf leaf-6" viewBox="0 0 32 32" aria-hidden="true"><path d="M26 4c-4 2-10 7-14 14-2 4-3.5 8-4 10 .5-.2 3-1.5 6-4 4-3.2 8-8 10-14 .8-2.2 1.5-4.2 2-6z"/></svg>

            <div className="hero-initials" aria-label="Couple initials">
              <span>F</span>
              <span className="hero-amp">&amp;</span>
              <span>P</span>
            </div>
            <p className="hero-kicker">{eventDetails.couple}</p>
            <h1>We Are Getting Married</h1>
          </div>
        </section>

        <section className="invite-card">
          {/* Leaf centered above invite text */}
          <svg className="invite-leaf leaf-7" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="gold-leaf-gradient-2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c9a84c" />
                <stop offset="40%" stopColor="#a8893d" />
                <stop offset="100%" stopColor="#5c4415" />
              </linearGradient>
            </defs>
            <path d="M26 4c-4 2-10 7-14 14-2 4-3.5 8-4 10 .5-.2 3-1.5 6-4 4-3.2 8-8 10-14 .8-2.2 1.5-4.2 2-6z" fill="url(#gold-leaf-gradient-2)"/>
          </svg>
          <p className="intro">You are invited to our wedding celebration.</p>
          <p className="event-date">Saturday, 25 April 2026</p>

          {countdown.complete ? (
            <p className="happening-now">Today is the day. Welcome to our wedding.</p>
          ) : (
            <div className="countdown-grid" role="timer" aria-live="polite">
              {countdownItems.map((item) => (
                <FlipUnit key={item.label} value={item.value} label={item.label} />
              ))}
            </div>
          )}

          <div className="vine-divider" aria-hidden="true" />

          <p className="note">
            We cannot wait to celebrate this beautiful day with family and friends.
          </p>

          <a className="scroll-link" href="#details" onClick={handleExploreDetailsClick}>
            Explore Details
          </a>
        </section>

        {/* ── Our Journey ── */}
        <section className="journey-section">
          <div className="journey-header scroll-reveal" ref={revealRef}>
            <h2 className="journey-title section-block-title">Our Journey</h2>
          </div>

          <div className="journey-grid">
            <div className="journey-item journey-item--tall scroll-reveal" ref={revealRef} style={{ transitionDelay: '0s' }} onClick={() => setJourneyLightbox(journeyImg1)}>
              <img className="journey-img" src={journeyImg1} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.1s' }} onClick={() => setJourneyLightbox(journeyImg2)}>
              <img className="journey-img" src={journeyImg2} alt="" />
            </div>
            <div className="journey-item journey-item--tall scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.2s' }} onClick={() => setJourneyLightbox(journeyImg3)}>
              <img className="journey-img" src={journeyImg3} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.3s' }} onClick={() => setJourneyLightbox(journeyImg4)}>
              <img className="journey-img" src={journeyImg4} alt="" />
            </div>
            <div className="journey-monogram scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.4s' }}>
              <span>F &amp; P</span>
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.5s' }} onClick={() => setJourneyLightbox(journeyImg5)}>
              <img className="journey-img" src={journeyImg5} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.6s' }} onClick={() => setJourneyLightbox(journeyImg6)}>
              <img className="journey-img" src={journeyImg6} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.7s' }} onClick={() => setJourneyLightbox(journeyImg7)}>
              <img className="journey-img" src={journeyImg7} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.8s' }} onClick={() => setJourneyLightbox(journeyImg10)}>
              <img className="journey-img" src={journeyImg10} alt="" />
            </div>
            <div className="journey-item scroll-reveal" ref={revealRef} style={{ transitionDelay: '0.9s' }} onClick={() => setJourneyLightbox(journeyImg9)}>
              <img className="journey-img" src={journeyImg9} alt="" />
            </div>
          </div>

          <div className="journey-quote">
            <div className="journey-quote-line" />
            <blockquote>
              &ldquo;<span className="quote-highlight">Obaa</span> ye turom mu nhwiren, ne <span className="quote-highlight-teal">kunu</span> nso ye ne ho ban.&rdquo;
            </blockquote>
          </div>
        </section>

        <section id="details" className="section-block event-section scroll-reveal" ref={revealRef}>
          <h3>{eventDetails.ceremony.title}</h3>
          <p>{eventDetails.ceremony.time}</p>
          <p>{eventDetails.ceremony.venue}</p>
          <p>{eventDetails.ceremony.address}</p>
        </section>

        <section className="section-block event-section scroll-reveal" ref={revealRef}>
          <h3>{eventDetails.reception.title}</h3>
          <p>{eventDetails.reception.time ? `${eventDetails.reception.time} - ` : ''}Celebration and Live Gallery</p>
          <p>{eventDetails.reception.venue}</p>
          <p>{eventDetails.reception.address}</p>
        </section>

        {/* <section className="section-block section-block--dark live-share-section scroll-reveal" ref={revealRef}>
          <h3>Live Share</h3>
          <p>Scan the QR code at reception to upload your photos and videos.</p>
          <p>
            <a className="scroll-link" href="/live/fp-live-2026">
              Open Live Share
            </a>
          </p>
        </section> */}

        <section className="section-block section-block--dark scroll-reveal" ref={revealRef}>
          <h3>Photo Gallery</h3>
          <p>View all the wonderful moments captured by our guests.</p>
          <a className="scroll-link" href="/gallery/fp-live-2026">
            View Gallery
          </a>
        </section>

        {/* <section className="section-block scroll-reveal" ref={revealRef}>
          <h3>Gift Registry</h3>
          <p>Help us start our new journey together.</p>
          <a className="scroll-link" href="/registry">
            View Registry
          </a>
        </section> */}

        <section className="section-block final-block map-section scroll-reveal" ref={revealRef}>
          <h3>Venue Directions</h3>

          <div className="map-grid">
            <article className="map-card">
              <h4>Ceremony</h4>
              <a className="map-link" href={eventDetails.ceremony.directionsUrl} target="_blank" rel="noreferrer">
                <iframe
                  title="Ceremony location map"
                  src={eventDetails.ceremony.mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </a>
            </article>

            <article className="map-card">
              <h4>Reception</h4>
              <a className="map-link" href={eventDetails.reception.directionsUrl} target="_blank" rel="noreferrer">
                <iframe
                  title="Reception location map"
                  src={eventDetails.reception.mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </a>
            </article>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="main-footer">
          <p>niiArdey <span className="footer-highlight">Dev</span> © 2026</p>
        </footer>
      </main>

      {/* ── Journey Lightbox ── */}
      {journeyLightbox && (
        <div className="journey-lightbox" onClick={() => setJourneyLightbox(null)}>
          <button className="journey-lightbox-close" onClick={() => setJourneyLightbox(null)}>✕</button>
          <img
            className="journey-lightbox-img"
            src={journeyLightbox}
            alt=""
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

export default App
