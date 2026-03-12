const BASE = '/api'

export async function fetchRates() {
  // Free API, no key required
  const res = await fetch('https://open.er-api.com/v6/latest/USD')
  if (!res.ok) throw new Error('No se pudieron cargar los tipos de cambio')
  const data = await res.json()
  return data.rates // { USD: 1, EUR: 0.93, CLP: 970, ... }
}

export async function fetchDashboard() {
  const res = await fetch(`${BASE}/dashboard`)
  if (!res.ok) throw new Error('Error al cargar el dashboard')
  return res.json()
}

export async function fetchPrices(origin, dest, trip_type = 'round_trip') {
  const res = await fetch(`${BASE}/prices/${origin}/${dest}?trip_type=${trip_type}`)
  if (!res.ok) throw new Error('Error al cargar historial de precios')
  return res.json()
}

export async function createTrip(trip) {
  const res = await fetch(`${BASE}/trips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al crear el viaje')
  }
  return res.json()
}

export async function deleteTrip(name) {
  const res = await fetch(`${BASE}/trips/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Error al eliminar el viaje')
}

export async function updateTrip(name, trip) {
  const res = await fetch(`${BASE}/trips/${encodeURIComponent(name)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trip),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Error al actualizar el viaje')
  }
  return res.json()
}

export async function updateThreshold(name, max_price) {
  const res = await fetch(`${BASE}/trips/${encodeURIComponent(name)}/threshold`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ max_price }),
  })
  if (!res.ok) throw new Error('Error al actualizar el umbral')
  return res.json()
}
