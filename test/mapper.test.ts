import { describe, it, expect } from 'vitest'
import { mapOrcaValues } from '../src/mapper'

describe('mapOrcaValues', () => {
  it('maps position from lat/lon', () => {
    const result = mapOrcaValues({
      'navigation.position.254.latitude': 59.9,
      'navigation.position.254.longitude': 10.7
    })
    expect(result).toEqual([
      { path: 'navigation.position', value: { latitude: 59.9, longitude: 10.7 } }
    ])
  })

  it('maps speed over ground', () => {
    const result = mapOrcaValues({
      'navigation.cogsog.254.speed': 3.5
    })
    expect(result).toEqual([
      { path: 'navigation.speedOverGround', value: 3.5 }
    ])
  })

  it('maps course over ground', () => {
    const result = mapOrcaValues({
      'navigation.cogsog.254.course': 1.23
    })
    expect(result).toEqual([
      { path: 'navigation.courseOverGroundTrue', value: 1.23 }
    ])
  })

  it('maps heading and variation', () => {
    const result = mapOrcaValues({
      'navigation.heading.254.heading': 2.1,
      'navigation.heading.254.variation': -0.05
    })
    expect(result).toEqual([
      { path: 'navigation.headingMagnetic', value: 2.1 },
      { path: 'navigation.magneticVariation', value: -0.05 }
    ])
  })

  it('maps apparent wind', () => {
    const result = mapOrcaValues({
      'environment.wind.254.2.speed': 7.2,
      'environment.wind.254.2.angle': 0.8
    })
    expect(result).toEqual([
      { path: 'environment.wind.speedApparent', value: 7.2 },
      { path: 'environment.wind.angleApparent', value: 0.8 }
    ])
  })

  it('maps true wind ground reference', () => {
    const result = mapOrcaValues({
      'environment.wind.254.0.speed': 6.0,
      'environment.wind.254.0.angle': 1.1
    })
    expect(result).toEqual([
      { path: 'environment.wind.speedTrue', value: 6.0 },
      { path: 'environment.wind.angleTrueGround', value: 1.1 }
    ])
  })

  it('maps depth below transducer', () => {
    const result = mapOrcaValues({
      'environment.depth.35.belowTransducer': 12.5
    })
    expect(result).toEqual([
      { path: 'environment.depth.belowTransducer', value: 12.5 }
    ])
  })

  it('maps water temperature', () => {
    const result = mapOrcaValues({
      'environment.temperature.35.0.temperature': 288.15
    })
    expect(result).toEqual([
      { path: 'environment.water.temperature', value: 288.15 }
    ])
  })

  it('maps rudder angle', () => {
    const result = mapOrcaValues({
      'steering.rudder.11.255.position': 0.1
    })
    expect(result).toEqual([
      { path: 'steering.rudderAngle', value: 0.1 }
    ])
  })

  it('maps battery voltage', () => {
    const result = mapOrcaValues({
      'battery.254.0.voltage': 12.8
    })
    expect(result).toEqual([
      { path: 'electrical.batteries.0.voltage', value: 12.8 }
    ])
  })

  it('maps attitude (roll, pitch, yaw)', () => {
    const result = mapOrcaValues({
      'environment.attitude.254.roll': 0.05,
      'environment.attitude.254.pitch': -0.02,
      'environment.attitude.254.yaw': 1.5
    })
    expect(result).toEqual([
      { path: 'navigation.attitude', value: { roll: 0.05, pitch: -0.02, yaw: 1.5 } }
    ])
  })

  it('returns empty array for unknown keys', () => {
    const result = mapOrcaValues({
      'some.unknown.key': 42
    })
    expect(result).toEqual([])
  })

  it('returns empty array for empty values', () => {
    const result = mapOrcaValues({})
    expect(result).toEqual([])
  })

  it('handles a full realistic message with multiple sensor values', () => {
    const result = mapOrcaValues({
      'navigation.position.254.latitude': 60.1,
      'navigation.position.254.longitude': 11.2,
      'navigation.cogsog.254.speed': 2.8,
      'navigation.cogsog.254.course': 0.5,
      'environment.wind.254.2.speed': 5.0,
      'environment.depth.35.belowTransducer': 8.3
    })
    expect(result).toHaveLength(5)
    expect(result[0]).toEqual({
      path: 'navigation.position',
      value: { latitude: 60.1, longitude: 11.2 }
    })
  })

  it.each([
    { deviceId: 35, label: 'default device 35' },
    { deviceId: 40, label: 'device 40' },
    { deviceId: 55, label: 'device 55' },
  ])('maps water speed and depth from $label', ({ deviceId }) => {
    const result = mapOrcaValues({
      [`environment.waterSpeed.${deviceId}.speed`]: 5.0,
      [`environment.waterSpeed.${deviceId+5}.speed`]: 999.0,
      [`environment.depth.${deviceId}.belowTransducer`]: 9.0,
      [`environment.depth.${deviceId+5}.belowTransducer`]: 999.0,
    })
    expect(result).toContainEqual({
      path: 'navigation.speedThroughWater',
      value: 5.0
    })
    expect(result).toContainEqual({
      path: 'environment.depth.belowTransducer',
      value: 9.0
    })
  })

  it.each([
    { deviceId: 35, instance: 0, label: 'device 35 instance 0' },
    { deviceId: 42, instance: 1, label: 'device 42 instance 1' },
    { deviceId: 99, instance: 0, label: 'device 99 instance 0' },
  ])('maps water temperature from $label', ({ deviceId, instance }) => {
    const result = mapOrcaValues({
      [`environment.temperature.${deviceId}.${instance}.temperature`]: 288.15,
    })
    expect(result).toContainEqual({
      path: 'environment.water.temperature',
      value: 288.15
    })
  })

  it.each([
    { deviceId: 11, instance: 255, label: 'device 11 instance 255' },
    { deviceId: 20, instance: 0, label: 'device 20 instance 0' },
    { deviceId: 5, instance: 128, label: 'device 5 instance 128' },
  ])('maps rudder angle from $label', ({ deviceId, instance }) => {
    const result = mapOrcaValues({
      [`steering.rudder.${deviceId}.${instance}.position`]: 0.1,
    })
    expect(result).toContainEqual({
      path: 'steering.rudderAngle',
      value: 0.1
    })
  })
})
