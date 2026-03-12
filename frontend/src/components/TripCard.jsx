import React, { useState } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { deleteTrip } from '../api.js'
import { convertPrice, formatPrice, displayPrice } from '../currencyUtils.js'
import PriceChart from './PriceChart.jsx'
import ThresholdEditor from './ThresholdEditor.jsx'
import AddTripModal from './AddTripModal.jsx'

export default function TripCard({ trip, origin, onUpdate, displayCurrency, rates }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)

  const {
    name,
    destination,
    trip_type = 'round_trip',
    stops,
    max_price,
    latest,
    prev_price,
    stats,
    smart_threshold,
  } = trip

  const stopsLabel = stops === 0 ? 'Directo' : stops === 1 ? 'Máx 1 escala' : null
  const storedCurrency = latest?.currency ?? trip.currency ?? 'USD'

  // Converted values for display
  const dispPrice = latest ? convertPrice(latest.price, storedCurrency, displayCurrency, rates) : null
  const dispPrevPrice = prev_price != null ? convertPrice(prev_price, storedCurrency, displayCurrency, rates) : null
  const priceChange = dispPrice != null && dispPrevPrice != null ? dispPrice - dispPrevPrice : null
  const belowThreshold = latest && max_price != null && latest.price <= max_price

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar viaje "${name}"?`)) return
    setDeleting(true)
    try {
      await deleteTrip(name)
      onUpdate()
    } catch (e) {
      alert(e.message)
      setDeleting(false)
    }
  }

  const isConverted = rates && displayCurrency !== storedCurrency

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={0.5}>
            <Typography variant="h6">{name}</Typography>
            <Stack direction="row" spacing={0.5}>
              {belowThreshold && <Chip label="Bajo umbral" color="success" size="small" />}
              {!latest && <Chip label="Sin datos" color="default" size="small" />}
            </Stack>
          </Stack>

          <Typography variant="body2" color="text.secondary" gutterBottom>
            {origin} → {destination} · {trip_type === 'round_trip' ? 'Ida y vuelta' : 'Solo ida'}
            {stopsLabel && ` · ${stopsLabel}`}
          </Typography>

          {latest ? (
            <>
              <Stack direction="row" alignItems="center" spacing={1} mt={1}>
                <Typography variant="h4" fontWeight="bold">
                  {displayCurrency} {formatPrice(dispPrice, displayCurrency)}
                </Typography>
                {priceChange !== null && (
                  <Chip
                    icon={priceChange < 0 ? <TrendingDownIcon /> : <TrendingUpIcon />}
                    label={`${priceChange < 0 ? '' : '+'}${formatPrice(Math.abs(priceChange), displayCurrency)}`}
                    color={priceChange < 0 ? 'success' : 'error'}
                    size="small"
                  />
                )}
              </Stack>

              {isConverted && (
                <Typography variant="caption" color="text.secondary">
                  {storedCurrency} {formatPrice(latest.price, storedCurrency)} original
                </Typography>
              )}

              <Stack direction="row" alignItems="center" spacing={1} mt={isConverted ? 0 : 0.25}>
                <Typography variant="caption" color="text.secondary">
                  {latest.airline} · {latest.outbound_date}
                </Typography>
                {latest.booking_url && (
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    href={latest.booking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    endIcon={<OpenInNewIcon />}
                    sx={{ ml: 1, py: 0, px: 1, minHeight: 0, fontSize: '0.7rem' }}
                  >
                    Comprar
                  </Button>
                )}
              </Stack>
            </>
          ) : (
            <Typography variant="h5" color="text.secondary" mt={1}>Sin datos</Typography>
          )}

          {stats && (
            <Stack direction="row" spacing={2} mt={1.5}>
              {[
                ['Min', stats.min],
                ['Avg', stats.avg],
                ['Max', stats.max],
              ].map(([label, val]) => (
                <Tooltip
                  key={label}
                  title={isConverted ? `${storedCurrency} ${formatPrice(val, storedCurrency)}` : ''}
                >
                  <Typography variant="caption" color="text.secondary">
                    {label}: {displayCurrency} {formatPrice(convertPrice(val, storedCurrency, displayCurrency, rates), displayCurrency)}
                  </Typography>
                </Tooltip>
              ))}
            </Stack>
          )}

          <Divider sx={{ my: 1.5 }} />

          <ThresholdEditor
            tripName={name}
            currentThreshold={max_price}
            storedCurrency={storedCurrency}
            displayCurrency={displayCurrency}
            rates={rates}
            smartSuggestion={smart_threshold}
            onUpdate={onUpdate}
          />
        </CardContent>

        <CardActions disableSpacing>
          <Tooltip title="Eliminar viaje">
            <IconButton size="small" color="error" onClick={handleDelete} disabled={deleting}>
              <DeleteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Editar viaje">
            <IconButton size="small" onClick={() => setEditing(true)}>
              <EditIcon />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={() => setExpanded(!expanded)}
            sx={{ ml: 'auto', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <ExpandMoreIcon />
          </IconButton>
        </CardActions>

        <Collapse in={expanded} unmountOnExit>
          <CardContent sx={{ pt: 0 }}>
            <PriceChart
              origin={origin}
              destination={destination}
              tripType={trip_type}
              threshold={max_price}
              storedCurrency={storedCurrency}
              displayCurrency={displayCurrency}
              rates={rates}
            />
          </CardContent>
        </Collapse>
      </Card>

      <AddTripModal
        open={editing}
        onClose={() => setEditing(false)}
        onSaved={() => { setEditing(false); onUpdate() }}
        initialTrip={trip}
      />
    </>
  )
}
