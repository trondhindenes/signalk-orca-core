import { describe, it, expect, vi } from 'vitest'
import { handleOrcaMessage, MessageSink } from '../src/handler'

function createMockSink() {
  return {
    handleMessage: vi.fn(),
    debug: vi.fn()
  } satisfies MessageSink
}

describe('handleOrcaMessage', () => {
  it('transforms an Orca position message into a SignalK delta', () => {
    const sink = createMockSink()

    handleOrcaMessage({
      timestamp: '2026-04-07T12:00:00Z',
      values: {
        'navigation.position.254.latitude': 59.9,
        'navigation.position.254.longitude': 10.7
      }
    }, sink)

    expect(sink.handleMessage).toHaveBeenCalledOnce()
    expect(sink.handleMessage).toHaveBeenCalledWith('signalk-orca-core', {
      context: 'vessels.self',
      updates: [{
        timestamp: '2026-04-07T12:00:00Z',
        values: [
          { path: 'navigation.position', value: { latitude: 59.9, longitude: 10.7 } }
        ]
      }]
    })
  })

  it('transforms a wind message into a SignalK delta', () => {
    const sink = createMockSink()

    handleOrcaMessage({
      timestamp: '2026-04-07T12:00:00Z',
      values: {
        'environment.wind.254.2.speed': 7.2,
        'environment.wind.254.2.angle': 0.8
      }
    }, sink)

    expect(sink.handleMessage).toHaveBeenCalledWith('signalk-orca-core', {
      context: 'vessels.self',
      updates: [{
        timestamp: '2026-04-07T12:00:00Z',
        values: [
          { path: 'environment.wind.speedApparent', value: 7.2 },
          { path: 'environment.wind.angleApparent', value: 0.8 }
        ]
      }]
    })
  })

  it('produces a multi-value delta from a realistic sensor message', () => {
    const sink = createMockSink()

    handleOrcaMessage({
      timestamp: '2026-04-07T12:01:00Z',
      values: {
        'navigation.position.254.latitude': 60.0,
        'navigation.position.254.longitude': 11.0,
        'navigation.cogsog.254.speed': 3.1,
        'navigation.heading.254.heading': 1.57,
        'environment.depth.35.belowTransducer': 15.2,
        'battery.254.0.voltage': 12.6
      }
    }, sink)

    expect(sink.handleMessage).toHaveBeenCalledOnce()
    const delta = sink.handleMessage.mock.calls[0][1]
    expect(delta.context).toBe('vessels.self')
    expect(delta.updates[0].timestamp).toBe('2026-04-07T12:01:00Z')

    const values = delta.updates[0].values
    expect(values).toHaveLength(5)
    expect(values).toContainEqual({ path: 'navigation.position', value: { latitude: 60.0, longitude: 11.0 } })
    expect(values).toContainEqual({ path: 'navigation.speedOverGround', value: 3.1 })
    expect(values).toContainEqual({ path: 'navigation.headingMagnetic', value: 1.57 })
    expect(values).toContainEqual({ path: 'environment.depth.belowTransducer', value: 15.2 })
    expect(values).toContainEqual({ path: 'electrical.batteries.0.voltage', value: 12.6 })
  })

  it('does not call handleMessage when values is empty', () => {
    const sink = createMockSink()
    handleOrcaMessage({ values: {} }, sink)
    expect(sink.handleMessage).not.toHaveBeenCalled()
  })

  it('does not call handleMessage when values is missing', () => {
    const sink = createMockSink()
    handleOrcaMessage({}, sink)
    expect(sink.handleMessage).not.toHaveBeenCalled()
  })

  it('does not call handleMessage when all values are unmapped', () => {
    const sink = createMockSink()
    handleOrcaMessage({
      values: { 'some.unknown.key': 42 }
    }, sink)
    expect(sink.handleMessage).not.toHaveBeenCalled()
  })
})
