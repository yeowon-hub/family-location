import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { HouseholdProvider } from '@/contexts/HouseholdContext'
import { LocationPage } from '@/pages/LocationPage'
import { ChemoCrosscheckPage } from '@/pages/ChemoCrosscheckPage'
import { SetupPage } from '@/pages/SetupPage'

function AppShell() {
  const { user } = useAuth()

  return (
    <HouseholdProvider user={user}>
      <div className="flex h-dvh min-h-0 flex-col">
        <Routes>
          <Route path="/" element={<LocationPage />} />
          <Route path="/chemo" element={<ChemoCrosscheckPage />} />
          <Route path="/qr" element={<ChemoCrosscheckPage />} />
          <Route path="/setup" element={<SetupPage />} />
        </Routes>
      </div>
    </HouseholdProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  )
}
