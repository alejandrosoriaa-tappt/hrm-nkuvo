import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import ResumenPage from './pages/ResumenPage.jsx'
import ContactosPage from './pages/ContactosPage.jsx'
import CalendarioPage from './pages/CalendarioPage.jsx'
import ReclutadorasPage from './pages/ReclutadorasPage.jsx'
import CvsPage from './pages/CvsPage.jsx'
import PlantillasPage from './pages/PlantillasPage.jsx'
import OportunidadesPage from './pages/OportunidadesPage.jsx'
import NotasPage from './pages/NotasPage.jsx'
import EtiquetasPage from './pages/EtiquetasPage.jsx'
import ReportesPage from './pages/ReportesPage.jsx'
import ConfiguracionPage from './pages/ConfiguracionPage.jsx'
import MembresiaPage from './pages/MembresiaPage.jsx'
import DirectorioLandingPage from './pages/DirectorioLandingPage.jsx'
import DirectorioGraciasPage from './pages/DirectorioGraciasPage.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Públicas */}
        <Route path="/login"  element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Landing de venta del directorio ($99, sin cuenta) — tráfico de anuncios */}
        <Route path="/directorio" element={<DirectorioLandingPage />} />
        <Route path="/directorio/gracias" element={<DirectorioGraciasPage />} />

        {/* Protegidas — Layout hace el guard de sesión */}
        <Route path="/app" element={<Layout />}>
          <Route index                  element={<ResumenPage />} />
          <Route path="contactos"       element={<ContactosPage />} />
          <Route path="calendario"      element={<CalendarioPage />} />
          <Route path="reclutadoras"    element={<ReclutadorasPage />} />
          <Route path="cvs"             element={<CvsPage />} />
          <Route path="plantillas"      element={<PlantillasPage />} />
          <Route path="oportunidades"   element={<OportunidadesPage />} />
          <Route path="notas"           element={<NotasPage />} />
          <Route path="etiquetas"       element={<EtiquetasPage />} />
          <Route path="reportes"        element={<ReportesPage />} />
          <Route path="configuracion"   element={<ConfiguracionPage />} />
          <Route path="membresia"       element={<MembresiaPage />} />
        </Route>

        {/* Raíz redirige al app */}
        <Route path="/" element={<Navigate to="/app" replace />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
