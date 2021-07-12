import 'dotenv/config'
import express from 'express'
import schedule from 'node-schedule'
import { setupDb, db } from './db.js'
import { updateHotspots } from './utils.js'

const ownerAddress = '12zX4jgDGMbJgRwmCfRNGXBuphkQRqkUTcLzYHTQvd4Qgu8kiL4'

const app = express()
const port = process.env.PORT || 8080

app.use('/', express.static('public'))

app.get('/stats', (req, res) => {
  if (!db.data) {
    return res.json({ error: 'Could not get stats' })
  }

  const { onboarded, asserted, hotspots } = db.data
  res.json({
    onboarded,
    asserted,
    hotspots,
  })
})
;(async () => {
  await setupDb()

  if (!db.data?.lastHash) {
    console.log('No last hash found, assuming database is empty')
    await updateHotspots(ownerAddress)
  }

  schedule.scheduleJob('0 0 * * *', () => updateHotspots(ownerAddress))
  app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
  })
})()
