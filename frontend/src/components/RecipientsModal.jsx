import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import DeleteIcon from '@mui/icons-material/Delete'
import { fetchRecipients, addRecipient, deleteRecipient } from '../api.js'

const EMPTY = { phone: '', apikey: '', name: '' }

export default function RecipientsModal({ open, onClose }) {
  const [recipients, setRecipients] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setRecipients(await fetchRecipients())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (open) { load(); setError(null); setForm(EMPTY) } }, [open])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  const handleAdd = async () => {
    if (!form.phone.trim() || !form.apikey.trim()) {
      setError('Teléfono y API key son requeridos')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await addRecipient({
        phone: form.phone.trim(),
        apikey: form.apikey.trim(),
        ...(form.name.trim() ? { name: form.name.trim() } : {}),
      })
      setForm(EMPTY)
      await load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (phone) => {
    if (!window.confirm(`¿Eliminar el número ${phone}?`)) return
    try {
      await deleteRecipient(phone)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Destinatarios de notificaciones</DialogTitle>
      <DialogContent>
        <Stack spacing={2} mt={1}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Lista actual ── */}
          {loading ? (
            <CircularProgress size={24} sx={{ alignSelf: 'center' }} />
          ) : recipients.length === 0 ? (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Sin destinatarios. Agrega uno abajo.{' '}
              <Typography component="span" variant="caption" color="text.secondary">
                (Fallback a env vars WHATSAPP_PHONE / CALLMEBOT_APIKEY)
              </Typography>
            </Alert>
          ) : (
            <List disablePadding>
              {recipients.map((r, i) => (
                <React.Fragment key={r.phone}>
                  {i > 0 && <Divider />}
                  <ListItem
                    disablePadding
                    secondaryAction={
                      <IconButton edge="end" size="small" color="error" onClick={() => handleDelete(r.phone)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" fontWeight="medium">{r.phone}</Typography>
                          {r.name && <Typography variant="caption" color="text.secondary">({r.name})</Typography>}
                        </Stack>
                      }
                      secondary={`API key: ${r.apikey}`}
                    />
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}

          <Divider />

          {/* ── Agregar nuevo ── */}
          <Typography variant="subtitle2">Agregar destinatario</Typography>
          <Typography variant="caption" color="text.secondary">
            Cada número necesita su propia API key de CallMeBot. El número debe activar el bot primero enviando{' '}
            <strong>I allow callmebot to send me messages</strong> al +34 644 37 79 96.
          </Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Teléfono" size="small" value={form.phone} onChange={set('phone')}
              placeholder="56912345678" sx={{ flex: 2 }}
            />
            <TextField
              label="Nombre (opcional)" size="small" value={form.name} onChange={set('name')}
              placeholder="Pablo" sx={{ flex: 1 }}
            />
          </Stack>
          <TextField
            label="API key de CallMeBot" size="small" value={form.apikey} onChange={set('apikey')}
            placeholder="1234567" fullWidth
            inputProps={{ style: { fontFamily: 'monospace' } }}
          />
          <Button variant="outlined" onClick={handleAdd} disabled={saving}>
            {saving ? 'Guardando...' : 'Agregar'}
          </Button>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}
