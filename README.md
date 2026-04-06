# signalk-orca-core

A [SignalK](https://signalk.org/) server plugin that ingests sensor data from an [Orca Core](https://www.orcamarine.com/) device via WebSocket and maps it to SignalK paths.

> **Disclaimer:** This is an independent, community-developed plugin. It is **not** affiliated with, endorsed by, or supported by Orca Marine Systems (the makers of Orca Core and the Orca app). Use at your own risk.

## Features

- Connects to Orca Core's WebSocket API (sensors, AIS, sync streams)
- Auto-discovers Orca Core on the local network via mDNS
- Maps Orca Core's flat sensor data to structured SignalK paths
- Uses Orca-processed data (device 254) where available for best accuracy
- Debug logging of all mappings via SignalK's plugin log facility

## Installation

### From npm (SignalK Appstore)

Search for "signalk-orca-core" in the SignalK Appstore (Server > Appstore in the admin UI).

### Manual / Development

```bash
git clone https://github.com/your-username/signalk-orca-core.git
cd signalk-orca-core
npm install
npm run build
npm link

cd ~/.signalk
npm link signalk-orca-core
```

Restart SignalK server, then enable the plugin in Server > Plugin Config.

## Configuration

| Setting | Default | Description |
|---|---|---|
| Auto-discover via mDNS | `true` | Automatically find Orca Core on the network |
| Discovery Timeout | `30` s | How long to search before falling back |
| Host | *(empty)* | Fallback host (or primary when auto-discover is off) |
| Port | `8089` | Orca Core WebSocket port |
| Sensor Interval | `200` ms | Sensor data update interval |
| AIS Interval | `5000` ms | AIS data update interval |
| Sync Ping Interval | `45` s | Keep-alive ping interval on sync connection |

## Docker

```bash
npm run build
docker compose up -d
```

The SignalK admin UI will be available at `http://localhost:3000`.

## Mapped Data

The plugin maps the following Orca Core data to SignalK paths:

| Orca Core | SignalK |
|---|---|
| `navigation.position.254.*` | `navigation.position` |
| `navigation.cogsog.254.speed` | `navigation.speedOverGround` |
| `navigation.cogsog.254.course` | `navigation.courseOverGroundTrue` |
| `navigation.heading.254.heading` | `navigation.headingMagnetic` |
| `navigation.heading.254.variation` | `navigation.magneticVariation` |
| `navigation.rot.254.rot` | `navigation.rateOfTurn` |
| `navigation.time.254.datetime` | `navigation.datetime` |
| `navigation.gnss.254.*` | `navigation.gnss.*` |
| `navigation.xte.254.xte` | `navigation.courseRhumbline.crossTrackError` |
| `environment.attitude.254.*` | `navigation.attitude` |
| `environment.wind.254.2.*` | `environment.wind.speedApparent` / `angleApparent` |
| `environment.wind.254.0.*` | `environment.wind.speedTrue` / `angleTrueGround` |
| `environment.wind.254.3.*` | `environment.wind.angleTrueWater` |
| `environment.depth.35.*` | `environment.depth.belowTransducer` |
| `environment.waterSpeed.35.speed` | `navigation.speedThroughWater` |
| `environment.temperature.35.0.*` | `environment.water.temperature` |
| `steering.rudder.11.255.position` | `steering.rudderAngle` |
| `battery.254.0.voltage` | `electrical.batteries.0.voltage` |

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
