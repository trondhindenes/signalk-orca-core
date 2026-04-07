export interface PathValue {
  path: string
  value: any
}

type DebugFn = (msg: string) => void

export function mapOrcaValues(
  values: Record<string, any>,
  debug?: DebugFn
): PathValue[] {
  const result: PathValue[] = []
  const v = (key: string) => values[key]
  const keys = Object.keys(values)

  /** Find the first key matching `prefix.<any segments>.suffix` and return its value */
  function firstMatch(prefix: string, suffix: string): { key: string, value: any } | undefined {
    const pat = `${prefix}.`
    const end = `.${suffix}`
    for (const k of keys) {
      if (k.startsWith(pat) && k.endsWith(end) && k.length > pat.length + end.length) {
        return { key: k, value: values[k] }
      }
    }
    return undefined
  }

  function emit(orcaKeys: string | string[], skPath: string, value: any) {
    result.push({ path: skPath, value })
    if (debug) {
      const from = Array.isArray(orcaKeys) ? orcaKeys.join(' + ') : orcaKeys
      debug(`${from} → ${skPath} = ${JSON.stringify(value)}`)
    }
  }

  // --- Navigation (device 254, Orca-processed) ---

  // Position (compound)
  const lat = v('navigation.position.254.latitude')
  const lon = v('navigation.position.254.longitude')
  if (lat != null && lon != null) {
    emit(
      ['navigation.position.254.latitude', 'navigation.position.254.longitude'],
      'navigation.position',
      { latitude: lat, longitude: lon }
    )
  }

  // COG / SOG
  if (v('navigation.cogsog.254.speed') != null) {
    emit('navigation.cogsog.254.speed', 'navigation.speedOverGround', v('navigation.cogsog.254.speed'))
  }
  if (v('navigation.cogsog.254.course') != null) {
    emit('navigation.cogsog.254.course', 'navigation.courseOverGroundTrue', v('navigation.cogsog.254.course'))
  }

  // Heading (reference=1 means magnetic)
  if (v('navigation.heading.254.heading') != null) {
    emit('navigation.heading.254.heading', 'navigation.headingMagnetic', v('navigation.heading.254.heading'))
  }
  if (v('navigation.heading.254.variation') != null) {
    emit('navigation.heading.254.variation', 'navigation.magneticVariation', v('navigation.heading.254.variation'))
  }

  // Rate of turn
  if (v('navigation.rot.254.rot') != null) {
    emit('navigation.rot.254.rot', 'navigation.rateOfTurn', v('navigation.rot.254.rot'))
  }

  // Datetime
  if (v('navigation.time.254.datetime') != null) {
    emit('navigation.time.254.datetime', 'navigation.datetime', v('navigation.time.254.datetime'))
  }

  // GNSS
  if (v('navigation.gnss.254.satellites') != null) {
    emit('navigation.gnss.254.satellites', 'navigation.gnss.satellites', v('navigation.gnss.254.satellites'))
  }
  if (v('navigation.gnss.254.HDOP') != null) {
    emit('navigation.gnss.254.HDOP', 'navigation.gnss.horizontalDilution', v('navigation.gnss.254.HDOP'))
  }
  if (v('navigation.gnss.254.PDOP') != null) {
    emit('navigation.gnss.254.PDOP', 'navigation.gnss.positionDilution', v('navigation.gnss.254.PDOP'))
  }
  if (v('navigation.gnss.254.altitude') != null) {
    emit('navigation.gnss.254.altitude', 'navigation.gnss.antennaAltitude', v('navigation.gnss.254.altitude'))
  }

  // Cross-track error
  if (v('navigation.xte.254.xte') != null) {
    emit('navigation.xte.254.xte', 'navigation.courseRhumbline.crossTrackError', v('navigation.xte.254.xte'))
  }

  // --- Attitude (device 254, compound) ---

  const roll = v('environment.attitude.254.roll')
  const pitch = v('environment.attitude.254.pitch')
  const yaw = v('environment.attitude.254.yaw')
  if (roll != null || pitch != null || yaw != null) {
    const attitude: Record<string, number> = {}
    if (roll != null) attitude.roll = roll
    if (pitch != null) attitude.pitch = pitch
    if (yaw != null) attitude.yaw = yaw
    emit(
      ['environment.attitude.254.roll', 'environment.attitude.254.pitch', 'environment.attitude.254.yaw'],
      'navigation.attitude',
      attitude
    )
  }

  // --- Wind (device 254, instance determines reference type) ---

  // Instance 2: Apparent wind
  if (v('environment.wind.254.2.speed') != null) {
    emit('environment.wind.254.2.speed', 'environment.wind.speedApparent', v('environment.wind.254.2.speed'))
  }
  if (v('environment.wind.254.2.angle') != null) {
    emit('environment.wind.254.2.angle', 'environment.wind.angleApparent', v('environment.wind.254.2.angle'))
  }

  // Instance 0: True wind (ground reference)
  if (v('environment.wind.254.0.speed') != null) {
    emit('environment.wind.254.0.speed', 'environment.wind.speedTrue', v('environment.wind.254.0.speed'))
  }
  if (v('environment.wind.254.0.angle') != null) {
    emit('environment.wind.254.0.angle', 'environment.wind.angleTrueGround', v('environment.wind.254.0.angle'))
  }

  // Instance 3: True wind (boat/water reference)
  if (v('environment.wind.254.3.angle') != null) {
    emit('environment.wind.254.3.angle', 'environment.wind.angleTrueWater', v('environment.wind.254.3.angle'))
  }

  // --- Sensor-only data (no device 254 equivalent) ---

  // Depth (any device)
  const depthBelow = firstMatch('environment.depth', 'belowTransducer')
  if (depthBelow) {
    emit(depthBelow.key, 'environment.depth.belowTransducer', depthBelow.value)
  }
  const depthOffset = firstMatch('environment.depth', 'offset')
  if (depthOffset) {
    emit(depthOffset.key, 'environment.depth.transducerToKeel', depthOffset.value)
  }

  // Water speed (any device)
  const waterSpeed = firstMatch('environment.waterSpeed', 'speed')
  if (waterSpeed) {
    emit(waterSpeed.key, 'navigation.speedThroughWater', waterSpeed.value)
  }

  // Water temperature (any device, any instance)
  const waterTemp = firstMatch('environment.temperature', 'temperature')
  if (waterTemp) {
    emit(waterTemp.key, 'environment.water.temperature', waterTemp.value)
  }

  // Rudder (any device, any instance)
  const rudder = firstMatch('steering.rudder', 'position')
  if (rudder) {
    emit(rudder.key, 'steering.rudderAngle', rudder.value)
  }

  // --- Electrical (device 254) ---

  // Battery (instance 0)
  if (v('battery.254.0.voltage') != null) {
    emit('battery.254.0.voltage', 'electrical.batteries.0.voltage', v('battery.254.0.voltage'))
  }

  return result
}
