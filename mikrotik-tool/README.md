# MikroTik Configuration Tool

A full-stack web application for managing MikroTik RouterOS devices. Connect to your router, configure features through a guided UI, preview generated scripts, apply changes, and maintain a full change log.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| State | Zustand |
| Router | React Router v6 |
| Charts | Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | SQLite (better-sqlite3) |
| Device API | RouterOS REST API v7 + SSH (node-ssh) |
| Realtime | WebSocket (ws) |
| Auth | JWT (jsonwebtoken) |
| Encryption | AES-256-GCM |

## Project Structure

```
mikrotik-tool/
├── frontend/          # React + Vite app
│   └── src/
│       ├── components/
│       │   ├── layout/    # Header, Sidebar, LogPanel, Layout
│       │   ├── common/    # Modal, Badge, CodePreview
│       │   └── features/  # ConnectionForm, FeatureSelector, forms/
│       ├── pages/         # Connect, Dashboard, Features, ChangeLog, Devices, Backup
│       ├── store/         # Zustand stores (device, config, log)
│       └── services/      # api.ts, websocket.ts
├── backend/           # Node.js + Express API
│   └── src/
│       ├── adapters/  # rest-adapter, ssh-adapter, connection-manager
│       ├── db/        # database.ts (SQLite)
│       ├── routes/    # connect, devices, config, apply, changelog, dashboard, backup
│       ├── services/  # config-engine, encryption
│       ├── middleware/ # auth (JWT)
│       └── websocket/ # ws-server
├── shared/            # TypeScript types shared by frontend & backend
├── migrations/        # 001_init.sql
├── samples/           # Sample .rsc scripts for each feature
├── .env.example
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+

### Development

```bash
# 1. Clone and navigate to project
cd mikrotik-tool

# 2. Copy environment file
cp .env.example .env
# Edit .env with your secrets

# 3. Install backend dependencies
cd backend
npm install

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Start backend (port 3001 + WS 3002)
cd ../backend
npm run dev

# 6. Start frontend (port 5173)
cd ../frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Docker Compose

```bash
cp .env.example .env
# Edit .env

docker compose up -d
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3002

## Features

### Feature 1 — Device Connection
- Connect via REST API (RouterOS v7) or SSH
- Auto-detect connection method with fallback
- Read full device config on connect (30+ API sections)
- Save credentials encrypted (AES-256) to SQLite

### Feature 2 — Feature Selector
Organized in 7 groups (A–G):
- **A** Network: IP Addresses, DHCP, DNS, VLAN, Bridge
- **B** Security: Firewall, NAT, Address Lists
- **C** VPN: WireGuard, OpenVPN, L2TP, SSTP
- **D** Routing: Static, OSPF, BGP, Mangle
- **E** Wireless: WiFi, CAPsMAN/WifiWave2
- **F** QoS: Simple Queues, Queue Tree, PCQ
- **G** System: Netwatch, SNMP, Syslog, NTP, Hardening

### Feature 3 — Config Engine
- Read existing config → compute diff → generate only what's needed
- Firewall rules tagged with `# TOOL:<feature>:<rule-name>` to detect duplicates
- Syntax-highlighted script preview with line-by-line diff view
- Copy to clipboard / Download as .rsc

### Feature 4 — Apply & Push
- Confirmation modal with change summary
- REST API or SSH execution, one command at a time
- Real-time progress via WebSocket
- Every command logged to SQLite

### Feature 5 — Change Log
- Full audit trail with filters (device, feature, result, date range)
- Expand any row to see payload, RouterOS command, raw response
- Rollback button generates reverse command
- Export as CSV or JSON
- Session grouping and cleanup

### Feature 6 — Dashboard
- Live metrics (CPU, RAM, uptime, DHCP leases)
- Interface traffic with historical charts (Recharts)
- Top firewall rules by packet count
- Recent device log entries
- Polls every 5 seconds

### Feature 7 — Backup & Profile
- Export full backup as .rsc (SSH /export or REST)
- Save named snapshots to SQLite
- Side-by-side diff between any two snapshots

## Database Schema

```sql
-- Saved devices (passwords AES-256 encrypted)
devices (id, label, host, port, username, password, connection_method, ros_version, last_connected)

-- Full audit log of every command sent
change_log (id, timestamp, device_ip, device_id, session_id, feature_group, action, api_path, payload, ros_command, result, response, applied_by)

-- Config snapshots
device_snapshots (id, device_id, label, snapshot_json, created_at)
```

## Security

- Passwords stored AES-256-GCM encrypted in SQLite
- JWT authentication (8h expiry) on all API routes
- Rate limiting: 500 req/15min general, 1 apply/5s per device
- Input validation with Zod on all endpoints
- CORS restricted to configured `FRONTEND_URL`
- Never exposes device credentials in API responses

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Backend HTTP port |
| `WS_PORT` | 3002 | WebSocket port |
| `JWT_SECRET` | *(required)* | JWT signing secret |
| `JWT_EXPIRY` | 8h | JWT token lifetime |
| `ENCRYPTION_KEY` | *(optional)* | 64-char hex AES-256 key |
| `DB_PATH` | ./data/mikrotik.db | SQLite database path |
| `APPLY_RATE_LIMIT_MS` | 5000 | Min ms between applies per device |
| `FRONTEND_URL` | http://localhost:5173 | Allowed CORS origin |

## Sample Scripts

See the `/samples` directory for example RouterOS scripts:

| File | Description |
|------|-------------|
| `wireguard.rsc` | WireGuard VPN setup |
| `firewall.rsc` | Firewall filter + NAT rules |
| `dhcp.rsc` | DHCP server with pools and networks |
| `vlan.rsc` | 802.1Q VLAN bridge configuration |
| `queues.rsc` | Simple Queues + PCQ Queue Tree |
| `ospf.rsc` | OSPF routing (RouterOS v7) |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Preview generated script |
| `Ctrl+Enter` | Apply changes to device |

## RouterOS Compatibility

- **REST API**: RouterOS 7.1+ required (port 8728 HTTP, 8729 HTTPS)
- **SSH**: RouterOS 6.x and 7.x
- **Config sections**: Tested with RouterOS 7.6+

## Architecture Notes

- Backend uses sync `better-sqlite3` for simple, deadlock-free DB operations
- WebSocket server runs on a separate port (3002) from the HTTP API (3001)
- All device connections are kept in memory (restart = reconnect)
- Config engine reads existing state before generating scripts (never blind overwrite)
- Firewall rules use comment tags to track tool-managed rules across sessions
