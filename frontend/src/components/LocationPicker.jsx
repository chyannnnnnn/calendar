import { useState, useEffect, useRef } from 'react'
import { useTheme } from '../lib/ThemeContext'

let _mapsPromise = null
function loadGoogleMaps(apiKey) {
  if (window.google?.maps?.places) return Promise.resolve(window.google.maps)
  if (_mapsPromise) return _mapsPromise
  _mapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
    script.async = true
    script.onload  = () => resolve(window.google.maps)
    script.onerror = () => { _mapsPromise = null; reject(new Error('Failed to load Google Maps. Check your API key.')) }
    document.head.appendChild(script)
  })
  return _mapsPromise
}

export default function LocationPicker({ value, onChange, apiKey, readOnly = false }) {
  const { C } = useTheme()
  const [open, setOpen]        = useState(false)
  const [status, setStatus]    = useState('idle')
  const [errorMsg, setErrorMsg]= useState('')
  const [query, setQuery]      = useState('')
  const [suggestions, setSugs] = useState([])
  const [pinned, setPinned]    = useState(null)

  const mapDivRef   = useRef(null)
  const mapRef      = useRef(null)
  const markerRef   = useRef(null)
  const geocoderRef = useRef(null)
  const acRef       = useRef(null)
  const tokenRef    = useRef(null)

  // When modal opens: reset local state and load SDK
  useEffect(() => {
    if (!open) return
    setPinned(value || null)
    setQuery(value?.name || '')
    setSugs([])
    if (!apiKey) { setStatus('error'); setErrorMsg('No Google Maps API key (VITE_GOOGLE_MAPS_KEY).'); return }
    setStatus('loading')
    loadGoogleMaps(apiKey)
      .then(() => setStatus('ready'))
      .catch(e => { setStatus('error'); setErrorMsg(e.message) })
  }, [open])

  // Init map once SDK is ready — wait a tick for the div to have dimensions
  useEffect(() => {
    if (status !== 'ready') return
    const t = setTimeout(() => {
      if (!mapDivRef.current || mapRef.current) return
      const G      = window.google.maps
      geocoderRef.current = new G.Geocoder()
      acRef.current       = new G.places.AutocompleteService()
      tokenRef.current    = new G.places.AutocompleteSessionToken()

      const center = value?.lat ? { lat: value.lat, lng: value.lng } : { lat: 5.4141, lng: 100.3288 }
      const map = new G.Map(mapDivRef.current, {
        center, zoom: value?.lat ? 16 : 12,
        disableDefaultUI: true, zoomControl: true,
      })
      mapRef.current = map

      if (value?.lat) dropPin(value.lat, value.lng, false, map)
      map.addListener('click', e => dropPin(e.latLng.lat(), e.latLng.lng(), true))
    }, 100)
    return () => clearTimeout(t)
  }, [status])

  function dropPin(lat, lng, animate, mapArg) {
    const G   = window.google.maps
    const map = mapArg || mapRef.current
    if (!map) return
    if (markerRef.current) {
      markerRef.current.setPosition({ lat, lng })
    } else {
      markerRef.current = new G.Marker({
        position: { lat, lng }, map, draggable: true,
        animation: animate ? G.Animation.DROP : null,
      })
      markerRef.current.addListener('dragend', e =>
        reverseGeocode(e.latLng.lat(), e.latLng.lng())
      )
    }
    map.panTo({ lat, lng })
    reverseGeocode(lat, lng)
  }

  function reverseGeocode(lat, lng) {
    if (!geocoderRef.current) return
    geocoderRef.current.geocode({ location: { lat, lng } }, (results, st) => {
      if (st === 'OK' && results[0]) {
        const loc = { name: results[0].formatted_address, lat, lng }
        setQuery(loc.name)
        setPinned(loc)
      }
    })
  }

  // Autocomplete with debounce
  useEffect(() => {
    if (!query || !acRef.current) { setSugs([]); return }
    const t = setTimeout(() => {
      acRef.current.getPlacePredictions(
        { input: query, sessionToken: tokenRef.current },
        (preds, st) => {
          const OK = window.google?.maps?.places?.PlacesServiceStatus?.OK
          setSugs(st === OK && preds ? preds : [])
        }
      )
    }, 280)
    return () => clearTimeout(t)
  }, [query])

  function selectSuggestion(placeId, description) {
    setSugs([])
    setQuery(description)
    geocoderRef.current?.geocode({ placeId }, (results, st) => {
      if (st === 'OK' && results[0]) {
        const lat = results[0].geometry.location.lat()
        const lng = results[0].geometry.location.lng()
        dropPin(lat, lng, true)
        mapRef.current?.setZoom(16)
        setPinned({ name: description, lat, lng })
        tokenRef.current = new window.google.maps.places.AutocompleteSessionToken()
      }
    })
  }

  function confirmAndClose() {
    onChange?.(pinned)
    closeModal()
  }

  function closeModal() {
    setOpen(false)
    mapRef.current    = null
    markerRef.current = null
  }

  function clearPin(e) {
    e?.stopPropagation()
    onChange?.(null)
    setPinned(null)
    setQuery('')
    if (markerRef.current) { markerRef.current.setMap(null); markerRef.current = null }
  }

  // READ-ONLY: shown inside event detail modal
  if (readOnly) {
    if (!value?.name) return null
    const url = value.lat
      ? `https://www.google.com/maps/dir/?api=1&destination=${value.lat},${value.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.name)}`
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{
        display:'flex', alignItems:'center', gap:11, fontSize:13,
        color:C.textMid, background:C.bg, borderRadius:10, padding:'10px 13px',
        textDecoration:'none', border:`1px solid ${C.border}`, transition:'all 0.2s',
      }}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=C.peach+'88';e.currentTarget.style.color=C.peach}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMid}}
      >
        <span style={{fontSize:18}}>📍</span>
        <span style={{flex:1,lineHeight:1.4}}>{value.name}</span>
        <span style={{fontSize:11,fontWeight:700,color:C.peach,background:C.peach+'18',border:`1px solid ${C.peach}44`,borderRadius:20,padding:'2px 10px'}}>↗ Maps</span>
      </a>
    )
  }

  // EDITABLE trigger
  return (
    <>
      <div onClick={() => setOpen(true)} style={{
        display:'flex', alignItems:'center', gap:10,
        background:C.surface, border:`1.5px solid ${value ? C.peach+'77' : C.border}`,
        borderRadius:10, padding:'10px 13px', cursor:'pointer', transition:'all 0.2s',
      }}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.peach+'88'}
        onMouseLeave={e=>e.currentTarget.style.borderColor=value?C.peach+'77':C.border}
      >
        <span style={{fontSize:18}}>{value ? '📍' : '🗺'}</span>
        <span style={{flex:1, fontSize:13, color:value?C.text:C.textDim, lineHeight:1.4}}>
          {value?.name || 'Tap to search & pin a location…'}
        </span>
        {value
          ? <button onClick={clearPin} style={{background:'none',border:'none',color:C.textDim,cursor:'pointer',fontSize:16,padding:'0 2px'}}>✕</button>
          : <span style={{fontSize:11,color:C.peach,fontWeight:700}}>Pin 📌</span>
        }
      </div>

      {open && (
        <div style={{
          position:'fixed', inset:0, zIndex:9999,
          background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:16,
        }}>
          <div style={{
            width:'min(540px,100%)', height:'min(680px,90vh)',
            background:C.surface, borderRadius:20, overflow:'hidden',
            display:'flex', flexDirection:'column',
            boxShadow:'0 32px 80px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{padding:'16px 18px 10px', borderBottom:`1px solid ${C.border}`, flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <span style={{fontFamily:"'Playfair Display'",fontSize:18,color:C.text}}>📍 Pick a location</span>
                <button onClick={closeModal} style={{background:'none',border:'none',color:C.textDim,fontSize:22,cursor:'pointer',lineHeight:1}}>✕</button>
              </div>
              <div style={{position:'relative'}}>
                <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:15,pointerEvents:'none'}}>🔍</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search for a place, café, address…"
                  value={query}
                  onChange={e => { setQuery(e.target.value) }}
                  style={{
                    width:'100%', background:C.bg, border:`1px solid ${C.border}`,
                    borderRadius:10, padding:'10px 13px 10px 38px',
                    color:C.text, fontSize:13, outline:'none',
                    boxSizing:'border-box', fontFamily:'inherit',
                  }}
                />
                {suggestions.length > 0 && (
                  <div style={{
                    position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:30,
                    background:C.surface, border:`1px solid ${C.border}`, borderRadius:12,
                    overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.3)',
                  }}>
                    {suggestions.map((s, i) => (
                      <div key={s.place_id}
                        onClick={() => selectSuggestion(s.place_id, s.description)}
                        style={{
                          padding:'10px 14px', cursor:'pointer', fontSize:13, color:C.text,
                          borderBottom: i < suggestions.length-1 ? `1px solid ${C.border}` : 'none',
                          display:'flex', alignItems:'center', gap:10, transition:'background 0.1s',
                        }}
                        onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                        onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                      >
                        <span style={{fontSize:14,flexShrink:0}}>📍</span>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {s.structured_formatting?.main_text || s.description}
                          </div>
                          <div style={{fontSize:11,color:C.textDim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {s.structured_formatting?.secondary_text}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{fontSize:11,color:C.textDim,marginTop:7}}>
                Or tap anywhere on the map to drop a pin 📌 · Drag to adjust
              </div>
            </div>

            {/* Map — fills remaining height */}
            <div style={{flex:1, position:'relative', minHeight:0}}>
              {status === 'loading' && (
                <div style={{position:'absolute',inset:0,zIndex:1,display:'flex',alignItems:'center',justifyContent:'center',background:C.bg,color:C.textDim,fontSize:13}}>
                  Loading map…
                </div>
              )}
              {status === 'error' && (
                <div style={{position:'absolute',inset:0,zIndex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:C.bg,padding:24,textAlign:'center',gap:8}}>
                  <span style={{fontSize:36}}>🗺</span>
                  <span style={{color:C.rose,fontSize:13,fontWeight:700}}>⚠️ {errorMsg}</span>
                  <span style={{color:C.textDim,fontSize:12}}>Add VITE_GOOGLE_MAPS_KEY to your .env and Vercel environment variables.</span>
                </div>
              )}
              <div ref={mapDivRef} style={{width:'100%',height:'100%'}} />
            </div>

            {/* Footer */}
            <div style={{padding:'12px 18px', borderTop:`1px solid ${C.border}`, flexShrink:0, display:'flex', alignItems:'center', gap:10}}>
              <div style={{flex:1, fontSize:12, color:C.textMid, lineHeight:1.4}}>
                {pinned?.name
                  ? <><span style={{color:C.mint,marginRight:5}}>✅</span>{pinned.name}</>
                  : <span style={{color:C.textDim}}>No location pinned yet — search or tap the map</span>
                }
              </div>
              {pinned && (
                <button onClick={()=>{setPinned(null);if(markerRef.current){markerRef.current.setMap(null);markerRef.current=null}}} style={{
                  background:'none',border:`1px solid ${C.border}`,borderRadius:10,
                  padding:'8px 14px',fontSize:12,color:C.textDim,cursor:'pointer',fontFamily:'inherit',fontWeight:600,
                }}>Clear</button>
              )}
              <button onClick={confirmAndClose} style={{
                background: pinned ? C.mint : C.surface,
                color: pinned ? '#fff' : C.textDim,
                border:`1px solid ${pinned ? C.mint : C.border}`,
                borderRadius:12, padding:'10px 22px', fontSize:14, fontWeight:700, cursor:'pointer',
              }}>
                {pinned ? 'Confirm 📍' : 'Skip'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}