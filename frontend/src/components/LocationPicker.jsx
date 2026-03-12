import { useState, useEffect, useRef, useCallback } from 'react'
import { useTheme } from '../lib/ThemeContext'

// Singleton SDK loader — only injects the script once
let _mapsPromise = null
function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps)
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.setAttribute('data-gm', '1')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload  = () => resolve(window.google.maps)
    script.onerror = () => { _mapsPromise = null; reject(new Error('Failed to load Google Maps. Check your API key.')) }
    document.head.appendChild(script)
  })
  return _mapsPromise
}

// ── LocationPicker ─────────────────────────────────────────────────────────────
// value:    { name, lat, lng } | null
// onChange: (value | null) => void
// apiKey:   string | undefined  — gracefully degrades if missing
// readOnly: boolean             — shows clickable link only, no editing

export default function LocationPicker({ value, onChange, apiKey, readOnly = false }) {
  const { C } = useTheme()
  const [open, setOpen]       = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const [loadErr, setLoadErr] = useState(null)
  const [query, setQuery]     = useState('')
  const [suggestions, setSugs]= useState([])

  const mapRef        = useRef(null)
  const mapInstance   = useRef(null)
  const markerRef     = useRef(null)
  const acService     = useRef(null)
  const geocoder      = useRef(null)
  const sessionToken  = useRef(null)

  // Load SDK when modal opens
  useEffect(() => {
    if (!open || !apiKey || loaded) return
    loadGoogleMaps(apiKey)
      .then(() => setLoaded(true))
      .catch(e => setLoadErr(e.message))
  }, [open, apiKey, loaded])

  // Init map after SDK loads
  useEffect(() => {
    if (!loaded || !open || !mapRef.current || mapInstance.current) return
    const G = window.google.maps
    acService.current    = new G.places.AutocompleteService()
    geocoder.current     = new G.Geocoder()
    sessionToken.current = new G.places.AutocompleteSessionToken()

    const center = value?.lat ? { lat: value.lat, lng: value.lng } : { lat: 5.4141, lng: 100.3288 }
    const map = new G.Map(mapRef.current, {
      center,
      zoom: value?.lat ? 16 : 12,
      disableDefaultUI: true,
      zoomControl: true,
      styles: isDark() ? darkMapStyle() : [],
    })
    mapInstance.current = map

    if (value?.lat) placeMarker(value.lat, value.lng, false)
    map.addListener('click', e => placeMarker(e.latLng.lat(), e.latLng.lng(), true))
  }, [loaded, open])

  function isDark() { return C.bg === '#1C1410' }

  function darkMapStyle() {
    return [
      { elementType: 'geometry',           stylers: [{ color: '#2c2015' }] },
      { elementType: 'labels.text.fill',   stylers: [{ color: '#c8b89a' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#1c1410' }] },
      { featureType: 'road', elementType: 'geometry',        stylers: [{ color: '#3d2e1e' }] },
      { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#211a11' }] },
      { featureType: 'water', elementType: 'geometry',       stylers: [{ color: '#1a2c3a' }] },
      { featureType: 'poi',   elementType: 'geometry',       stylers: [{ color: '#2d2010' }] },
    ]
  }

  function placeMarker(lat, lng, animate = true) {
    const G = window.google.maps
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng })
    } else {
      markerRef.current = new G.Marker({
        position: { lat, lng },
        map: mapInstance.current,
        draggable: true,
        animation: animate ? G.Animation.DROP : null,
      })
      markerRef.current.addListener('dragend', e =>
        reverseGeocode(e.latLng.lat(), e.latLng.lng())
      )
    }
    mapInstance.current.panTo({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function reverseGeocode(lat, lng) {
    if (!geocoder.current) return
    geocoder.current.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const name = results[0].formatted_address
        setQuery(name)
        onChange?.({ name, lat, lng })
      }
    })
  }

  // Autocomplete with debounce
  const fetchSuggestions = useCallback((input) => {
    if (!input || !acService.current) { setSugs([]); return }
    acService.current.getPlacePredictions(
      { input, sessionToken: sessionToken.current },
      (preds, status) => {
        const ok = window.google?.maps?.places?.PlacesServiceStatus?.OK
        setSugs(status === ok && preds ? preds : [])
      }
    )
  }, [])

  useEffect(() => {
    const t = setTimeout(() => fetchSuggestions(query), 280)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  function selectSuggestion(placeId, description) {
    setSugs([])
    setQuery(description)
    if (!geocoder.current) return
    geocoder.current.geocode({ placeId }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat()
        const lng = results[0].geometry.location.lng()
        placeMarker(lat, lng, true)
        mapInstance.current.setZoom(16)
        onChange?.({ name: description, lat, lng })
        sessionToken.current = new window.google.maps.places.AutocompleteSessionToken()
      }
    })
  }

  function clearLocation(e) {
    e?.stopPropagation()
    onChange?.(null)
    setQuery('')
    if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null }
  }

  function openModal() {
    mapInstance.current = null  // force map re-init
    markerRef.current   = null
    setOpen(true)
    setQuery(value?.name || '')
    setSugs([])
    setLoadErr(null)
  }

  // ── READ-ONLY: tappable link row ──────────────────────────────────────────────
  if (readOnly) {
    if (!value?.name) return null
    const mapsUrl = value.lat
      ? `https://www.google.com/maps/search/?api=1&query=${value.lat},${value.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.name)}`
    return (
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 11, fontSize: 13,
          color: C.textMid, background: C.bg, borderRadius: 10, padding: '10px 13px',
          textDecoration: 'none', border: `1px solid ${C.border}`, transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = C.peach + '88'; e.currentTarget.style.color = C.peach }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMid }}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>📍</span>
        <span style={{ flex: 1, lineHeight: 1.4 }}>{value.name}</span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: C.peach,
          background: C.peach + '18', border: `1px solid ${C.peach}44`,
          borderRadius: 20, padding: '2px 10px', flexShrink: 0,
        }}>↗ Maps</span>
      </a>
    )
  }

  // ── EDIT TRIGGER ──────────────────────────────────────────────────────────────
  return (
    <>
      <div onClick={openModal} style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.surface, border: `1.5px solid ${value ? C.peach + '77' : C.border}`,
        borderRadius: 10, padding: '10px 13px', cursor: 'pointer', transition: 'all 0.2s',
      }}
        onMouseEnter={e => e.currentTarget.style.borderColor = C.peach + '88'}
        onMouseLeave={e => e.currentTarget.style.borderColor = value ? C.peach + '77' : C.border}
      >
        <span style={{ fontSize: 18, flexShrink: 0 }}>{value ? '📍' : '🗺'}</span>
        <span style={{ flex: 1, fontSize: 13, color: value ? C.text : C.textDim, lineHeight: 1.4 }}>
          {value?.name || 'Search & pin a location…'}
        </span>
        {value
          ? <button onClick={clearLocation} style={{ background: 'none', border: 'none', color: C.textDim, cursor: 'pointer', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>✕</button>
          : <span style={{ fontSize: 11, color: C.peach, fontWeight: 700 }}>Pin 📌</span>
        }
      </div>

      {/* ── PICKER MODAL ─────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{
            width: 'min(540px,100%)', maxHeight: '90vh',
            background: C.surface, borderRadius: 20, overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
          }}>

            {/* Header */}
            <div style={{ padding: '16px 18px 10px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: "'Playfair Display'", fontSize: 18, color: C.text }}>📍 Pick a location</span>
                <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
              </div>

              {/* No API key warning */}
              {!apiKey ? (
                <div style={{ background: C.rose + '18', border: `1px solid ${C.rose}44`, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.rose, lineHeight: 1.6 }}>
                  <strong>⚠️ Google Maps API key not set.</strong><br />
                  Add <code>VITE_GOOGLE_MAPS_KEY</code> to your <code>.env</code> file and Vercel environment variables, then redeploy.
                </div>
              ) : (
                /* Search input */
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none' }}>🔍</span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search for a café, address, place…"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    style={{
                      width: '100%', background: C.bg, border: `1px solid ${C.border}`,
                      borderRadius: 10, padding: '11px 13px 11px 40px',
                      color: C.text, fontSize: 13, outline: 'none',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                    }}
                  />
                  {/* Autocomplete dropdown */}
                  {suggestions.length > 0 && (
                    <div style={{
                      position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
                      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                      overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
                    }}>
                      {suggestions.map((s, i) => (
                        <div key={s.place_id}
                          onClick={() => selectSuggestion(s.place_id, s.description)}
                          style={{
                            padding: '10px 14px', cursor: 'pointer', fontSize: 13, color: C.text,
                            borderBottom: i < suggestions.length - 1 ? `1px solid ${C.border}` : 'none',
                            display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.12s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = C.bg}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ fontSize: 15, flexShrink: 0 }}>📍</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.structured_formatting?.main_text || s.description}
                            </div>
                            <div style={{ fontSize: 11, color: C.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {s.structured_formatting?.secondary_text || ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ fontSize: 11, color: C.textDim, marginTop: 8 }}>
                Tap anywhere on the map to drop a pin 📌 · Drag pin to fine-tune
              </div>
            </div>

            {/* Map area */}
            <div style={{ flex: 1, minHeight: 300, position: 'relative', background: C.bg }}>
              <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 300 }} />
              {apiKey && !loaded && !loadErr && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.textDim, fontSize: 13 }}>
                  Loading map…
                </div>
              )}
              {loadErr && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.rose, fontSize: 13, padding: 20, textAlign: 'center' }}>
                  ⚠️ {loadErr}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, fontSize: 12, color: C.textMid, lineHeight: 1.4 }}>
                {value?.name
                  ? <><span style={{ color: C.mint, marginRight: 6 }}>✅</span>{value.name}</>
                  : <span style={{ color: C.textDim }}>No location pinned yet</span>
                }
              </div>
              {value && (
                <button onClick={clearLocation} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 14px', fontSize: 12, color: C.textDim, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                  Clear
                </button>
              )}
              <button onClick={() => setOpen(false)} style={{
                background: C.mint, color: '#fff', border: 'none',
                borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              }}>
                {value ? 'Confirm 📍' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}