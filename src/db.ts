import { fileURLToPath, URL } from 'node:url'
import { Low, JSONFile } from 'lowdb'
import { Hotspot } from './models.js'

type Data = {
  lastHash: string
  onboarded: number
  asserted: number
  hotspots: { [key: string]: Hotspot }
  witnesses: { [key: string]: Hotspot }
}
const file = fileURLToPath(new URL('../db.json', import.meta.url))
const adapter = new JSONFile<Data>(file)

export const db = new Low<Data>(adapter)
export const setupDb = async () => {
  await db.read()
  db.data ||= {
    lastHash: '',
    onboarded: 0,
    asserted: 0,
    hotspots: {},
    witnesses: {},
  }
  console.log('Loaded DB, hotspot count:', Object.keys(db.data.hotspots).length)
}
