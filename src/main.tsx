import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import LiveSharePage from './pages/LiveSharePage.tsx'
import GalleryPage from './pages/GalleryPage.tsx'
// import RegistryPage from './pages/RegistryPage.tsx'
import AdminPage from './pages/AdminPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/live" element={<LiveSharePage />} />
        <Route path="/live/:token" element={<LiveSharePage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/gallery/:token" element={<GalleryPage />} />
        {/* <Route path="/registry" element={<RegistryPage />} /> */}
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
