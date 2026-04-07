import { mapOrcaValues } from './mapper'

export interface OrcaMessage {
  event_type?: string
  context?: string
  timestamp?: string
  devices?: Record<string, string>
  values?: Record<string, any>
}

export interface MessageSink {
  handleMessage: (id: string, delta: any) => void
  debug: (msg: string) => void
}

export function handleOrcaMessage(data: OrcaMessage, sink: MessageSink) {
  const values = data.values
  if (!values || Object.keys(values).length === 0) return

  const pathValues = mapOrcaValues(values, sink.debug)
  if (pathValues.length === 0) return

  sink.handleMessage('signalk-orca-core', {
    context: 'vessels.self',
    updates: [{
      timestamp: data.timestamp,
      values: pathValues
    }]
  })
}
