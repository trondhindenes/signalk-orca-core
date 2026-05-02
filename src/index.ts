import { Plugin, ServerAPI } from '@signalk/server-api'
import WebSocket from 'ws'
import { discoverOrcaCore } from './discovery'
import { handleOrcaMessage, OrcaMessage } from './handler'

interface OrcaCoreConfig {
  autoDiscover: boolean
  discoveryTimeout: number
  host: string
  port: number
  sensorInterval: number
  aisInterval: number
  syncPingInterval: number
}

const RECONNECT_DELAY_MS = 5000
const REDISCOVERY_INTERVAL_MS = 30000
const REDISCOVERY_TIMEOUT_MS = 5000

module.exports = (app: ServerAPI): Plugin => {
  const sockets = new Set<WebSocket>()
  const reconnectTimers = new Set<ReturnType<typeof setTimeout>>()
  let pingTimer: ReturnType<typeof setInterval> | undefined
  let rediscoveryTimer: ReturnType<typeof setInterval> | undefined
  let cancelDiscovery: (() => void) | undefined
  let discoveryInProgress = false
  let stopped = false

  function buildSensorUrl(config: OrcaCoreConfig): string {
    return `ws://${config.host}:${config.port}/v1/sensors/full?interval=${config.sensorInterval}&ns=^(?!.*(ais))`
  }

  function buildAisUrl(config: OrcaCoreConfig): string {
    return `ws://${config.host}:${config.port}/v1/sensors/full?interval=${config.aisInterval}&ns=ais&enableUnknownSources`
  }

  function buildSyncUrl(config: OrcaCoreConfig): string {
    return `ws://${config.host}:${config.port}/v1/sync`
  }

  const sink = { handleMessage: app.handleMessage.bind(app), debug: app.debug.bind(app) }

  function scheduleReconnect(name: string, buildUrl: () => string, config: OrcaCoreConfig, ping: boolean) {
    if (stopped) return
    app.debug(`[${name}] Reconnecting in ${RECONNECT_DELAY_MS}ms`)
    const timer = setTimeout(() => {
      reconnectTimers.delete(timer)
      if (!stopped) connectWebSocket(name, buildUrl, config, ping)
    }, RECONNECT_DELAY_MS)
    reconnectTimers.add(timer)
  }

  function connectWebSocket(
    name: string,
    buildUrl: () => string,
    config: OrcaCoreConfig,
    ping: boolean
  ) {
    const url = buildUrl()
    app.debug(`[${name}] Connecting to ${url}`)
    const ws = new WebSocket(url)
    sockets.add(ws)

    ws.on('open', () => {
      app.debug(`[${name}] Connected`)
      app.setPluginStatus(`Connected to Orca Core`)

      if (ping) {
        if (pingTimer) clearInterval(pingTimer)
        pingTimer = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ cmd: 'ping' }))
          }
        }, config.syncPingInterval * 1000)
      }
    })

    ws.on('message', (raw: WebSocket.Data) => {
      try {
        const data: OrcaMessage = JSON.parse(raw.toString())
        handleOrcaMessage(data, sink)
      } catch (e) {
        app.debug(`[${name}] Failed to parse message: ${e}`)
      }
    })

    ws.on('close', () => {
      app.debug(`[${name}] Connection closed`)
      sockets.delete(ws)
      if (ping && pingTimer) {
        clearInterval(pingTimer)
        pingTimer = undefined
      }
      scheduleReconnect(name, buildUrl, config, ping)
    })

    ws.on('error', (err: Error) => {
      app.error(`[${name}] WebSocket error: ${err.message}`)
      app.setPluginError(`[${name}] ${err.message}`)
    })
  }

  function startRediscovery(config: OrcaCoreConfig) {
    if (rediscoveryTimer) clearInterval(rediscoveryTimer)
    rediscoveryTimer = setInterval(() => {
      if (stopped || discoveryInProgress) return
      if (reconnectTimers.size === 0) return

      app.debug(`[rediscovery] Connection(s) pending reconnect, running mDNS scan`)
      discoveryInProgress = true
      const discovery = discoverOrcaCore(REDISCOVERY_TIMEOUT_MS, app.debug)
      cancelDiscovery = discovery.cancel
      discovery.promise.then((result) => {
        discoveryInProgress = false
        cancelDiscovery = undefined
        if (stopped || !result) return
        if (result.host !== config.host || result.port !== config.port) {
          app.debug(`[rediscovery] Host changed: ${config.host}:${config.port} → ${result.host}:${result.port}`)
          app.setPluginStatus(`Rediscovered Orca Core at ${result.host}`)
          config.host = result.host
          config.port = result.port
        }
      })
    }, REDISCOVERY_INTERVAL_MS)
  }

  const plugin: Plugin = {
    id: 'signalk-orca-core',
    name: 'Orca Core',
    description: 'Ingests data from Orca Core into SignalK',

    start: (settings: any) => {
      stopped = false
      cancelDiscovery = undefined

      const config: OrcaCoreConfig = {
        autoDiscover: settings.autoDiscover !== undefined ? settings.autoDiscover : true,
        discoveryTimeout: settings.discoveryTimeout || 30,
        host: settings.host,
        port: settings.port || 8089,
        sensorInterval: settings.sensorInterval || 200,
        aisInterval: settings.aisInterval || 5000,
        syncPingInterval: settings.syncPingInterval || 45
      }

      const connect = (cfg: OrcaCoreConfig) => {
        connectWebSocket('SENSOR', () => buildSensorUrl(cfg), cfg, false)
        connectWebSocket('AIS', () => buildAisUrl(cfg), cfg, false)
        connectWebSocket('SYNC', () => buildSyncUrl(cfg), cfg, true)
        if (cfg.autoDiscover) startRediscovery(cfg)
      }

      if (!config.autoDiscover && !config.host) {
        app.setPluginError('Orca Core Host is required when auto-discover is disabled')
        return
      }

      if (config.autoDiscover) {
        app.setPluginStatus('Searching for Orca Core...')
        const discovery = discoverOrcaCore(config.discoveryTimeout * 1000, app.debug)
        cancelDiscovery = discovery.cancel

        discovery.promise.then((result) => {
          if (stopped) return
          cancelDiscovery = undefined

          if (result) {
            app.debug(`[start] Discovered Orca Core via mDNS: ${result.host}:${result.port} (${result.name})`)
            config.host = result.host
            config.port = result.port
            connect(config)
          } else if (config.host) {
            app.debug(`[start] mDNS discovery failed, falling back to configured host: ${config.host}:${config.port}`)
            app.setPluginStatus(`Discovery failed, using fallback ${config.host}`)
            connect(config)
          } else {
            app.error('[start] mDNS discovery failed and no fallback host configured')
            app.setPluginError('Discovery failed and no fallback host configured')
          }
        })
      } else {
        app.debug(`[start] Auto-discover disabled, using configured host: ${config.host}:${config.port}`)
        connect(config)
      }
    },

    stop: () => {
      stopped = true
      if (cancelDiscovery) {
        cancelDiscovery()
        cancelDiscovery = undefined
      }
      for (const t of reconnectTimers) clearTimeout(t)
      reconnectTimers.clear()
      if (rediscoveryTimer) {
        clearInterval(rediscoveryTimer)
        rediscoveryTimer = undefined
      }
      if (pingTimer) {
        clearInterval(pingTimer)
        pingTimer = undefined
      }
      for (const ws of sockets) {
        ws.close()
      }
      sockets.clear()
    },

    schema: {
      type: 'object',
      properties: {
        autoDiscover: {
          type: 'boolean',
          title: 'Auto-discover Orca Core via mDNS',
          default: true
        },
        discoveryTimeout: {
          type: 'number',
          title: 'Discovery Timeout (seconds)',
          default: 30
        },
        host: {
          type: 'string',
          title: 'Orca Core Host (used as fallback when auto-discover is on, required when off)',
          pattern: '^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)*[a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?$',
          default: '10.11.12.1'
        },
        port: {
          type: 'number',
          title: 'Orca Core Port',
          default: 8089
        },
        sensorInterval: {
          type: 'number',
          title: 'Sensor Update Interval (ms)',
          default: 200
        },
        aisInterval: {
          type: 'number',
          title: 'AIS Update Interval (ms)',
          default: 5000
        },
        syncPingInterval: {
          type: 'number',
          title: 'Sync Ping Interval (seconds)',
          default: 45
        }
      }
    }
  }

  return plugin
}
