import fetch from 'node-fetch'
import { setupDb, db } from './db.js'
import { Activity, ApiHotspot, Hotspot } from './models.js'

/**
 * Fetch a single hotspot by address
 */
export async function getHotspot(address: string): Promise<ApiHotspot> {
  try {
    const req = await fetch('https://api.helium.io/v1/hotspots/' + address)
    const { data } = await req.json()
    return data
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Fetch all (newly added) hotspots from an account address
 */
export async function getHotspots(address: string) {
  if (!address) return
  if (!db.data) return
  console.log('Fetching hotspots')

  let lastHash = ''
  let prevCursor = ''
  let added = 0
  let stop = false
  while (true && !stop) {
    const req = await fetch(
      `https://api.helium.io/v1/accounts/${address}/activity?cursor=${prevCursor}`
    )
    let { data, cursor } = await req.json()

    for (let act of data as Activity[]) {
      if (!lastHash) lastHash = act.hash
      if (db.data.lastHash === act.hash) {
        stop = true
        break
      }
      if (act.type !== 'add_gateway_v1') continue
      added += 1
      db.data.onboarded += 1

      if (!(act.gateway in db.data.hotspots)) {
        db.data.hotspots[act.gateway] = new Hotspot(act.gateway)
      }
    }
    prevCursor = cursor
    if (!prevCursor) break
  }

  db.data.lastHash = lastHash
  console.log('Added', added, 'hotspots')
}

/**
 * Update location for all the hotspots in the database
 */
export async function updateLocations() {
  if (!db.data) return

  const hotspotCalls = Object.keys(db.data.hotspots).map((addr) =>
    getHotspot(addr)
  )
  const results = await Promise.allSettled(hotspotCalls)

  db.data.asserted = 0
  for (const result of results) {
    if (result.status === 'rejected') {
      console.log('Could not fetch hotspot', result.reason)
      continue
    }

    const { address, name, lat, lng } = result.value
    db.data.hotspots[address].name = name

    if (lat && lng) {
      db.data.hotspots[address].lat = lat
      db.data.hotspots[address].lng = lng
      db.data.asserted += 1
    }
  }
}

export async function updateHotspots(address: string) {
  if (!address) return
  if (!db.data) return
  await getHotspots(address)
  await updateLocations()

  console.log('saving db')
  await db.write()
}
