import fetch from 'node-fetch'
import { db } from './db.js'
import { Activity, ApiHotspot, Hotspot } from './models.js'

const timeout = (ms = 100) => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), ms)
  })
}

const heliumApi = async (path: string, afterError = false): Promise<any> => {
  try {
    const req = await fetch('https://api.helium.io/v1/' + path)
    const result = await req.json()
    if ('error' in result) throw new Error(result.error)
    if (afterError) console.log(path, 'was succesful after some retries')

    return result
  } catch (error) {
    console.log('Retrying', path, 'in 20 seconds')

    await timeout(20000)
    return await heliumApi(path, true)
    // throw new Error(error)
  }
}

/**
 * Fetch a single hotspot by address
 */
export async function getHotspot(address: string): Promise<ApiHotspot> {
  try {
    const { data } = await heliumApi('hotspots/' + address)
    return data
  } catch (error) {
    throw new Error(error)
  }
}

/**
 * Fetch witnesses for a single hotspot by address
 */
export async function getWitnesses(address: string): Promise<ApiHotspot[]> {
  try {
    const { data } = await heliumApi(`hotspots/${address}/witnesses`)
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
    let { data, cursor } = await heliumApi(
      `accounts/${address}/activity?cursor=${prevCursor}`
    )

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

export async function updateWitnesses() {
  if (!db.data) return

  const dbHotspots = Object.keys(db.data.hotspots)
  const witnessCalls = dbHotspots.map((addr) => getWitnesses(addr))
  const results = await Promise.allSettled(witnessCalls)

  db.data.witnesses = {}

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    if (result.status === 'rejected') {
      console.log('Could not fetch witnesses for hotspot', result.reason)
      continue
    }
    if (!result.value) {
      console.log('Could not fetch witnesses for hotspot, no results')
      continue
    }

    const parentAddress = dbHotspots[i]
    let witnesses: string[] = []
    for (const hs of result.value) {
      const { address, name, lat, lng } = hs
      if (!(address in db.data.witnesses)) {
        db.data.witnesses[address] = new Hotspot(address, name, lat, lng)
      }
      witnesses.push(address)
    }

    db.data.hotspots[parentAddress].witnesses = witnesses
  }
}

export async function updateHotspots(address: string) {
  if (!address) return
  if (!db.data) return
  await getHotspots(address)
  await updateLocations()
  await updateWitnesses()

  console.log('saving db')
  await db.write()
}
