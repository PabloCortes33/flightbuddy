import React, { useState, useEffect, useCallback } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import NotificationsIcon from '@mui/icons-material/Notifications'
import IconButton from '@mui/material/IconButton'
import { fetchDashboard, fetchRates } from './api.js'
import TripCard from './components/TripCard.jsx'
import AddTripModal from './components/AddTripModal.jsx'
import RecipientsModal from './components/RecipientsModal.jsx'

const CURRENCIES = ['USD', 'EUR', 'CLP']
const LS_KEY = 'flightbuddy_currency'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [recipientsOpen, setRecipientsOpen] = useState(false)
  const [currencySelectOpen, setCurrencySelectOpen] = useState(false)

  const [displayCurrency, setDisplayCurrency] = useState(
    () => localStorage.getItem(LS_KEY) || 'USD'
  )
  const [rates, setRates] = useState(null)
  const [ratesError, setRatesError] = useState(false)

  const load = useCallback(async () => {
    try {
      setError(null)
      const d = await fetchDashboard()
      setData(d)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetchRates()
      .then(setRates)
      .catch(() => setRatesError(true))
  }, [])

  const handleCurrencyChange = (e) => {
    const c = e.target.value
    setDisplayCurrency(c)
    localStorage.setItem(LS_KEY, c)
  }

  return (
    <>
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <Box component="img" src="/flying-fish-icon.png" alt="FlightBuddy" sx={{ width: 28, height: 28, mr: 1, filter: 'invert(1)' }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>FlightBuddy</Typography>

          <Tooltip title={ratesError ? 'No se pudieron cargar los tipos de cambio' : 'Moneda de visualización'} open={currencySelectOpen ? false : undefined}>
            <Select
              value={displayCurrency}
              onChange={handleCurrencyChange}
              onOpen={() => setCurrencySelectOpen(true)}
              onClose={() => setCurrencySelectOpen(false)}
              size="small"
              sx={{
                color: 'inherit',
                mr: 2,
                '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.4)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.7)' },
                '.MuiSvgIcon-root': { color: 'inherit' },
              }}
            >
              {CURRENCIES.map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </Tooltip>

          <Tooltip title="Destinatarios de notificaciones">
            <IconButton color="inherit" onClick={() => setRecipientsOpen(true)} sx={{ mr: 1 }}>
              <NotificationsIcon />
            </IconButton>
          </Tooltip>
          <Button color="inherit" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
            Agregar viaje
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 3, mb: 4 }}>
        {loading && (
          <Box display="flex" justifyContent="center" mt={6}>
            <CircularProgress />
          </Box>
        )}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {data && (
          <Grid container spacing={3}>
            {data.trips.map(trip => (
              <Grid item xs={12} md={6} key={trip.name}>
                <TripCard
                  trip={trip}
                  onUpdate={load}
                  displayCurrency={displayCurrency}
                  rates={rates}
                />
              </Grid>
            ))}
            {data.trips.length === 0 && (
              <Grid item xs={12}>
                <Alert severity="info">
                  No hay viajes configurados. Agrega uno con el botón de arriba.
                </Alert>
              </Grid>
            )}
          </Grid>
        )}
      </Container>

      <AddTripModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); load() }}
        defaultOrigin={data?.origin ?? 'SCL'}
      />
      <RecipientsModal
        open={recipientsOpen}
        onClose={() => setRecipientsOpen(false)}
      />
    </>
  )
}
