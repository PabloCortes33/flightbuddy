import React, { useState, useEffect, forwardRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'
import InputAdornment from '@mui/material/InputAdornment'
import DatePicker, { registerLocale } from 'react-datepicker'
import { es } from 'date-fns/locale'
import 'react-datepicker/dist/react-datepicker.css'
import { createTrip, updateTrip } from '../api.js'

registerLocale('es', es)

// Helpers
const toDate = (str) => str ? new Date(str + 'T12:00:00') : null
const toStr = (d) => d ? d.toISOString().split('T')[0] : ''

// MUI TextField como input del DatePicker (modo popup)
const MuiDateInput = forwardRef(({ value, onClick, label, placeholder }, ref) => (
  <TextField
    size="small"
    fullWidth
    label={label}
    value={value || ''}
    onClick={onClick}
    ref={ref}
    placeholder={placeholder || 'dd/mm/aaaa'}
    InputLabelProps={{ shrink: true }}
    inputProps={{ readOnly: true, style: { cursor: 'pointer' } }}
    InputProps={{
      endAdornment: (
        <InputAdornment position="end">
          <CalendarTodayIcon fontSize="small" sx={{ color: 'action.active', cursor: 'pointer' }} />
        </InputAdornment>
      ),
    }}
  />
))

const EMPTY_FORM = {
  name: '',
  destination: '',
  trip_type: 'round_trip',
  duration_days: 7,
  currency: 'USD',
  max_price: '',
  stops: '',
  date_mode: 'flexible',
  date_from: '',
  date_to: '',
  specific_dates: [{ outbound: '', return: '' }],
}

function tripToForm(trip) {
  const form = {
    ...EMPTY_FORM,
    name: trip.name ?? '',
    destination: trip.destination ?? '',
    trip_type: trip.trip_type ?? 'round_trip',
    duration_days: trip.duration_days ?? 7,
    currency: trip.currency ?? 'USD',
    max_price: trip.max_price != null ? String(trip.max_price) : '',
    stops: trip.stops != null ? String(trip.stops) : '',
  }
  if (trip.date_range) {
    form.date_mode = 'flexible'
    form.date_from = trip.date_range.from ?? ''
    form.date_to = trip.date_range.to ?? ''
  } else if (trip.specific_dates?.length) {
    form.date_mode = 'fixed'
    form.specific_dates = trip.specific_dates.map(p => ({
      outbound: p.outbound ?? '',
      return: p.return ?? '',
    }))
  } else {
    form.date_mode = 'none'
  }
  return form
}

// Estilos para que el calendario encaje con MUI
const datePickerSx = {
  '& .react-datepicker': {
    fontFamily: 'inherit',
    fontSize: '0.85rem',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: 3,
  },
  '& .react-datepicker__header': {
    backgroundColor: 'background.paper',
    borderBottom: '1px solid',
    borderColor: 'divider',
    paddingTop: '10px',
  },
  '& .react-datepicker__current-month, & .react-datepicker__day-name': {
    color: 'text.primary',
  },
  '& .react-datepicker__day': {
    color: 'text.primary',
    borderRadius: '50% !important',
    '&:hover': { backgroundColor: 'action.hover' },
  },
  '& .react-datepicker__day--selected, & .react-datepicker__day--range-start, & .react-datepicker__day--range-end': {
    backgroundColor: '#1976d2 !important',
    color: '#fff !important',
  },
  '& .react-datepicker__day--in-range': {
    backgroundColor: '#e3f2fd !important',
    color: '#1976d2 !important',
  },
  '& .react-datepicker__day--in-selecting-range': {
    backgroundColor: '#bbdefb !important',
  },
  '& .react-datepicker__day--disabled': {
    color: 'text.disabled',
  },
  '& .react-datepicker__navigation-icon::before': {
    borderColor: 'text.secondary',
  },
}

export default function AddTripModal({ open, onClose, onSaved, initialTrip = null }) {
  const isEdit = Boolean(initialTrip)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(initialTrip ? tripToForm(initialTrip) : EMPTY_FORM)
      setError(null)
    }
  }, [open, initialTrip])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const setDatePair = (i, field) => (date) => {
    setForm(f => {
      const pairs = [...f.specific_dates]
      pairs[i] = { ...pairs[i], [field]: toStr(date) }
      return { ...f, specific_dates: pairs }
    })
  }
  const addDatePair = () =>
    setForm(f => ({ ...f, specific_dates: [...f.specific_dates, { outbound: '', return: '' }] }))
  const removeDatePair = (i) =>
    setForm(f => ({ ...f, specific_dates: f.specific_dates.filter((_, idx) => idx !== i) }))

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.destination.trim()) {
      setError('Nombre y destino son requeridos')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const trip = {
        name: form.name.trim(),
        destination: form.destination.trim().toUpperCase(),
        trip_type: form.trip_type,
        duration_days: parseInt(form.duration_days, 10) || 7,
        currency: form.currency,
      }
      if (form.max_price) trip.max_price = parseFloat(form.max_price)
      if (form.stops !== '') trip.stops = parseInt(form.stops, 10)

      if (form.date_mode === 'flexible') {
        if (!form.date_from || !form.date_to) {
          setError('Selecciona el rango de fechas en el calendario')
          setLoading(false)
          return
        }
        trip.date_range = { from: form.date_from, to: form.date_to }
      } else if (form.date_mode === 'fixed') {
        const pairs = form.specific_dates.filter(p => p.outbound)
        if (!pairs.length) {
          setError('Agrega al menos una fecha de salida')
          setLoading(false)
          return
        }
        trip.specific_dates = pairs.map(p => ({
          outbound: p.outbound,
          ...(form.trip_type === 'round_trip' && p.return ? { return: p.return } : {}),
        }))
      }

      if (isEdit) {
        await updateTrip(initialTrip.name, trip)
      } else {
        await createTrip(trip)
      }
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Editar: ${initialTrip?.name}` : 'Agregar viaje'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Básico ── */}
          <TextField
            label="Nombre del viaje" value={form.name} onChange={set('name')}
            required fullWidth placeholder="Santiago → Miami"
          />
          <TextField
            label="Destino (código IATA)" value={form.destination} onChange={set('destination')}
            required fullWidth placeholder="MIA"
            inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
          />
          <Stack direction="row" spacing={2}>
            <FormControl fullWidth>
              <InputLabel>Tipo de viaje</InputLabel>
              <Select value={form.trip_type} label="Tipo de viaje" onChange={set('trip_type')}>
                <MenuItem value="round_trip">Ida y vuelta</MenuItem>
                <MenuItem value="one_way">Solo ida</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Duración (días)" type="number" value={form.duration_days}
              onChange={set('duration_days')} fullWidth inputProps={{ min: 1 }}
            />
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Escalas</InputLabel>
            <Select value={form.stops} label="Escalas" onChange={set('stops')}>
              <MenuItem value="">Cualquiera</MenuItem>
              <MenuItem value="0">Solo vuelos directos</MenuItem>
              <MenuItem value="1">Máximo 1 escala</MenuItem>
            </Select>
          </FormControl>

          <Divider />

          {/* ── Fechas ── */}
          <FormControl fullWidth>
            <InputLabel>Modo de fechas</InputLabel>
            <Select value={form.date_mode} label="Modo de fechas" onChange={set('date_mode')}>
              <MenuItem value="flexible">Rango flexible — viajo entre X e Y</MenuItem>
              <MenuItem value="fixed">Fechas fijas — sé exactamente cuándo quiero viajar</MenuItem>
              <MenuItem value="none">Sin fechas — monitorear siempre (30 días adelante)</MenuItem>
            </Select>
          </FormControl>

          {form.date_mode === 'flexible' && (
            <Box sx={datePickerSx}>
              <DatePicker
                selectsRange
                inline
                locale="es"
                dateFormat="dd/MM/yyyy"
                startDate={toDate(form.date_from)}
                endDate={toDate(form.date_to)}
                onChange={([start, end]) => setForm(f => ({
                  ...f,
                  date_from: toStr(start),
                  date_to: toStr(end),
                }))}
                minDate={new Date()}
                calendarClassName="fb-range-calendar"
              />
              {form.date_from && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {form.date_from}{form.date_to ? ` → ${form.date_to}` : ' → …'}
                </Typography>
              )}
            </Box>
          )}

          {form.date_mode === 'fixed' && (
            <Stack spacing={1.5}>
              <Typography variant="caption" color="text.secondary">
                El bot usará el primer par de fechas que aún no haya pasado
              </Typography>
              {form.specific_dates.map((pair, i) => (
                <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                  <Box sx={datePickerSx} flex={1}>
                    <DatePicker
                      locale="es"
                      dateFormat="dd/MM/yyyy"
                      selected={toDate(pair.outbound)}
                      onChange={setDatePair(i, 'outbound')}
                      minDate={new Date()}
                      customInput={<MuiDateInput label="Salida" />}
                    />
                  </Box>
                  {form.trip_type === 'round_trip' && (
                    <Box sx={datePickerSx} flex={1}>
                      <DatePicker
                        locale="es"
                        dateFormat="dd/MM/yyyy"
                        selected={toDate(pair.return)}
                        onChange={setDatePair(i, 'return')}
                        minDate={toDate(pair.outbound) || new Date()}
                        customInput={<MuiDateInput label="Regreso" />}
                      />
                    </Box>
                  )}
                  <IconButton
                    size="small" color="error" sx={{ mt: 0.5 }}
                    onClick={() => removeDatePair(i)}
                    disabled={form.specific_dates.length === 1}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={addDatePair} sx={{ alignSelf: 'flex-start' }}>
                Agregar par de fechas
              </Button>
            </Stack>
          )}

          {form.date_mode === 'none' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              El bot buscará precios 30 días hacia adelante en cada chequeo.
            </Alert>
          )}

          <Divider />

          {/* ── Alerta ── */}
          <Stack direction="row" spacing={2}>
            <TextField
              label="Precio máximo (umbral)" type="number" value={form.max_price}
              onChange={set('max_price')} fullWidth placeholder="800"
            />
            <FormControl fullWidth>
              <InputLabel>Moneda</InputLabel>
              <Select value={form.currency} label="Moneda" onChange={set('currency')}>
                <MenuItem value="USD">USD</MenuItem>
                <MenuItem value="EUR">EUR</MenuItem>
                <MenuItem value="CLP">CLP</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={loading}>
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
