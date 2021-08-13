import 'https://api.mapbox.com/mapbox-gl-js/v2.3.1/mapbox-gl.js'
import '//unpkg.com/alpinejs'

mapboxgl.accessToken =
  'pk.eyJ1IjoibG9uZ2FwbWFwIiwiYSI6ImNrcXhvdjU2YzEwYmEzMW82cmJ4NDYwN3UifQ.VXOoomAQiX_nYwCKx7dfnA'

const ucfirst = (str) => str[0].toUpperCase() + str.slice(1)

async function getHotspots() {
  const req = await fetch('/stats')
  return await req.json()
}

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/dark-v10',
  center: [30, 50],
  zoom: 3,
})

Alpine.store('overlay', {
  loaded: false,
  onboarded: 0,
  asserted: 0,
  changeWitnessOverlay(e) {
    if (!map.getLayer('witnesses')) return
    map.setLayoutProperty(
      'witnesses',
      'visibility',
      e.target.checked ? 'visible' : 'none'
    )
  },
})

map.on('load', async function () {
  const { onboarded, asserted, hotspots, witnesses } = await getHotspots()
  let overlay = Alpine.store('overlay')
  overlay.onboarded = onboarded
  overlay.asserted = asserted
  overlay.loaded = true

  let features = []
  for (const addr of Object.keys(hotspots)) {
    const hs = hotspots[addr]
    if (!hs.lng || !hs.lat) continue

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [hs.lng, hs.lat],
      },
      properties: {
        address: addr,
        name: hs.name,
      },
    })
  }

  let witnessesFeatures = []
  for (const addr of Object.keys(hotspots)) {
    const hs = hotspots[addr]
    if (!hs.lng || !hs.lat || !hs.witnesses || !hs.witnesses.length) continue

    for (const witnessAddr of hs.witnesses) {
      const witness = witnesses[witnessAddr]
      if (!(witnessAddr in hotspots) || !witness) continue

      let linkExists = witnessesFeatures.find((f) => {
        const { coordinates } = f.geometry
        return (
          coordinates[0][0] === witness.lng &&
          coordinates[0][1] == witness.lat &&
          coordinates[1][0] === hs.lng &&
          coordinates[1][1] == hs.lat
        )
      })
      if (linkExists) continue

      witnessesFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [hs.lng, hs.lat],
            [witness.lng, witness.lat],
          ],
        },
      })
    }
  }

  // Add the hotspots as a source.
  map.addSource('points', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features,
    },
  })

  // Add the witnesses as a source.
  map.addSource('witnesses', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: witnessesFeatures,
    },
  })

  map.addLayer({
    id: 'witnesses',
    type: 'line',
    source: 'witnesses',
    layout: {
      'line-join': 'round',
      'line-cap': 'round',
      visibility: 'none',
    },
    paint: {
      'line-color': 'rgba(255,210,0,.3)',
      'line-width': 1,
    },
  })

  map.addLayer({
    id: 'points',
    type: 'circle',
    source: 'points',
    paint: {
      'circle-radius': 4,
      'circle-color': '#0080FE',
    },
  })

  // Show tooltip when clicking points
  map.on('click', 'points', (e) => {
    const coordinates = e.features[0].geometry.coordinates.slice()
    const { name, address } = e.features[0].properties
    const description = `
      <h2>${name.split('-').map(ucfirst).join(' ')}</h2>
      <a href="https://explorer.helium.com/hotspots/${address}" target="_blank">View on explorer</a>`

    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360
    }

    new mapboxgl.Popup().setLngLat(coordinates).setHTML(description).addTo(map)
  })

  // Cursor when hovering over points
  map.on('mouseenter', 'points', () => {
    map.getCanvas().style.cursor = 'pointer'
  })

  map.on('mouseleave', 'points', () => {
    map.getCanvas().style.cursor = ''
  })
})
