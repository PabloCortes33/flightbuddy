import React, { useEffect, useState } from 'react'
import { LineChart, ChartsReferenceLine } from '@mui/x-charts'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { fetchPrices } from '../api.js'
import { convertPrice } from '../currencyUtils.js'

export default function PriceChart({ origin, destination, tripType, threshold, storedCurrency, displayCurrency, rates }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchPrices(origin, destination, tripType)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [origin, destination, tripType])

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" p={2}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (!data || !data.prices.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sin historial de precios
      </Typography>
    )
  }

  const from = storedCurrency || data.prices[0]?.currency || 'USD'
  const to = displayCurrency || from

  const convert = (p) => convertPrice(p, from, to, rates) ?? p

  const xData = data.prices.map(p => new Date(p.checked_at))
  const yData = data.prices.map(p => convert(p.price))
  const dispAvg = data.avg != null ? convert(data.avg) : null
  const dispThreshold = threshold != null ? convert(threshold) : null

  return (
    <LineChart
      xAxis={[{
        data: xData,
        scaleType: 'time',
        tickLabelStyle: { fontSize: 11 },
      }]}
      series={[{
        data: yData,
        label: `Precio (${to})`,
        color: '#1976d2',
        showMark: true,
      }]}
      height={220}
      margin={{ top: 10, bottom: 30, left: 65, right: 10 }}
    >
      {dispAvg != null && (
        <ChartsReferenceLine
          y={dispAvg}
          label="Promedio"
          lineStyle={{ stroke: '#ff9800', strokeDasharray: '4 2' }}
          labelStyle={{ fill: '#ff9800', fontSize: 11 }}
        />
      )}
      {dispThreshold != null && (
        <ChartsReferenceLine
          y={dispThreshold}
          label="Umbral"
          lineStyle={{ stroke: '#4caf50', strokeDasharray: '4 2' }}
          labelStyle={{ fill: '#4caf50', fontSize: 11 }}
        />
      )}
    </LineChart>
  )
}
