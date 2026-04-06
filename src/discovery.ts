import Bonjour, { Service } from 'bonjour-service'

export interface DiscoveryResult {
  host: string
  port: number
  name: string
  method: 'mdns' | 'fallback-static' | 'manual'
}

const ORCA_SERVICE_REGEX = /^orca-([a-zA-Z0-9]{6})(-\d)? ORCA$/
const DEFAULT_PORT = 8089

export function discoverOrcaCore(
  timeoutMs: number,
  debug: (msg: string) => void
): { promise: Promise<DiscoveryResult | null>; cancel: () => void } {
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const bonjour = new Bonjour()

  debug(`[discovery] Starting mDNS browse for _http._tcp, timeout ${timeoutMs}ms`)

  const browser = bonjour.find({ type: 'http' })

  const promise = new Promise<DiscoveryResult | null>((resolve) => {
    browser.on('up', (service: Service) => {
      if (settled) return

      if (ORCA_SERVICE_REGEX.test(service.name)) {
        settled = true
        if (timer) clearTimeout(timer)
        browser.stop()
        bonjour.destroy()
        debug(`[discovery] Matched Orca Core: "${service.name}" -> ${service.host}`)
        resolve({
          host: service.host,
          port: DEFAULT_PORT,
          name: service.name,
          method: 'mdns'
        })
      } else {
        debug(`[discovery] Found non-Orca Core: "${service.name}" at ${service.host}:${service.port}`)
      }
    })

    timer = setTimeout(() => {
      if (!settled) {
        settled = true
        browser.stop()
        bonjour.destroy()
        debug(`[discovery] mDNS timeout after ${timeoutMs}ms, no Orca Core found`)
        resolve(null)
      }
    }, timeoutMs)
  })

  const cancel = () => {
    if (!settled) {
      settled = true
      if (timer) clearTimeout(timer)
      browser.stop()
      bonjour.destroy()
      debug('[discovery] Cancelled')
    }
  }

  return { promise, cancel }
}
