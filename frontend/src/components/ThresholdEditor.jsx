import React, { useState, useEffect } from 'react'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import { updateThreshold } from '../api.js'
import { convertPrice, formatPrice } from '../currencyUtils.js'

export default function ThresholdEditor({
  tripName,
  currentThreshold,
  storedCurrency,
  displayCurrency,
  rates,
  smartSuggestion,
  onUpdate,
}) {
  // The editor always works in storedCurrency to avoid rounding issues when saving
  const [value, setValue] = useState(currentThreshold?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(currentThreshold?.toString() ?? '')
  }, [currentThreshold])

  const isConverted = rates && displayCurrency && displayCurrency !== storedCurrency

  // Convert a stored-currency value to display currency for the suggestion chip label
  const dispSuggestion = smartSuggestion != null
    ? convertPrice(smartSuggestion, storedCurrency, displayCurrency, rates)
    : null

  const handleSave = async () => {
    const price = parseFloat(value)
    if (isNaN(price) || price <= 0) return
    setSaving(true)
    try {
      await updateThreshold(tripName, price)
      onUpdate()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Stack spacing={1}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="caption" color="text.secondary">
          Umbral de alerta ({storedCurrency})
          {isConverted && currentThreshold != null && (
            <Typography component="span" variant="caption" color="text.disabled">
              {' '}≈ {displayCurrency} {formatPrice(convertPrice(currentThreshold, storedCurrency, displayCurrency, rates), displayCurrency)}
            </Typography>
          )}
        </Typography>
        {dispSuggestion != null && (
          <Tooltip title={`${storedCurrency} ${formatPrice(smartSuggestion, storedCurrency)}`}>
            <Chip
              icon={<AutoFixHighIcon />}
              label={isConverted
                ? `Sugerido: ${displayCurrency} ${formatPrice(dispSuggestion, displayCurrency)}`
                : `Sugerido: ${formatPrice(smartSuggestion, storedCurrency)}`
              }
              size="small"
              variant="outlined"
              onClick={() => setValue(smartSuggestion.toString())}
              clickable
            />
          </Tooltip>
        )}
      </Stack>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          type="number"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Sin umbral"
          sx={{ flexGrow: 1 }}
        />
        <Button size="small" variant="outlined" onClick={handleSave} disabled={saving}>
          {saving ? '...' : 'Guardar'}
        </Button>
      </Stack>
    </Stack>
  )
}
