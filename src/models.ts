export class Hotspot {
  name = ''
  address = ''
  lat: number | null = null
  lng: number | null = null
  witnesses?: string[]

  constructor(
    address = '',
    name = '',
    lat: number | null = null,
    lng: number | null = null
  ) {
    this.address = address
    this.name = name
    this.lat = lat
    this.lng = lng
  }
}

type ActivityType = 'assert_location_v2' | 'add_gateway_v1'

interface ActivityBase {
  type: ActivityType
  fee: number
  gateway: string
  hash: string
  height: number
  owner: string
  payer: string
  staking_fee: number
  time: number
}

interface AddGatewayActivity extends ActivityBase {
  type: 'add_gateway_v1'
}

interface AssertLocationActivity extends ActivityBase {
  type: 'assert_location_v2'
  elevation: number
  gain: number
  lat: number
  lng: number
  location: string
  nonce: number
}

export type Activity = AddGatewayActivity | AssertLocationActivity

export interface ApiHotspot {
  address: string
  name: string
  type: string
  owner: string
  status: ApiHotspotStatus
  mode: string
  timestamp_added: string
  reward_scale: number | null
  gain: number
  elevation: number
  block: number
  block_added: number
  geocode: ApiHotspotGeocode
  lng: number
  lat: number
}

export interface ApiHotspotStatus {
  online: string
  listen_addrs: string[] | null
  height: number
}

export interface ApiHotspotGeocode {
  short_street: string
  short_state: string
  short_country: string
  short_city: string
  long_street: string
  long_state: string
  long_country: string
  long_city: string
  city_id: string
}
