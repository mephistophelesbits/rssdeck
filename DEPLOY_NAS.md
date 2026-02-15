# RSS Deck - Synology NAS Deployment Guide

## Prerequisites

1. **Synology NAS** with Docker installed
2. **SSH access** to your NAS (optional but recommended)
3. **Git** installed on NAS (or upload files via File Station)

---

## Option 1: Quick Deploy via Docker Compose

### 1. Upload Files to NAS

Upload the RSS Deck folder to your NAS, e.g.:
```
/volume1/docker/rss-deck/
```

### 2. SSH into NAS (recommended)

```bash
ssh your_user@your_nas_ip
cd /volume1/docker/rss-deck
```

### 3. Build and Run

```bash
# Build the image
docker compose -f docker-compose.nas.yml build

# Start in detached mode
docker compose -f docker-compose.nas.yml up -d

# Check status
docker ps
```

### 4. Access RSS Deck

Open your browser:
```
http://your_nas_ip:3005
```

---

## Option 2: Synology Docker GUI (No SSH)

### 1. Prepare Files

1. Copy RSS Deck folder to NAS (e.g., `/volume1/docker/rss-deck`)
2. Make sure these files are present:
   - `docker-compose.nas.yml`
   - `Dockerfile`
   - `package.json`
   - All source files

### 2. Open Docker App

1. Open **Container Manager** (or Docker) on Synology
2. Go to **Project** → **Create**
3. Select the RSS Deck folder
4. Choose `docker-compose.nas.yml`
5. Configure settings:
   - Network mode: Bridge
   - Port mapping: 3005:3000
   - Enable auto-restart
6. Click **Next** → **Done**

### 3. Verify

1. Check **Container** tab for `rss-deck` status
2. Open browser: `http://nas_ip:3005`

---

## Configuration

### Change Port

Edit `docker-compose.nas.yml`:
```yaml
ports:
  - "YOUR_PORT:3000"  # e.g., "8080:3000"
```

### Set Timezone

The compose file already includes `TZ=Asia/Kuala_Lumpur`. Change if needed.

### Volume Persistence

Settings are stored in Docker volume `rss-deck-data`:
- AI API keys
- Briefing settings
- Cache data

---

## Management Commands

```bash
# View logs
docker compose -f docker-compose.nas.yml logs -f

# Restart
docker compose -f docker-compose.nas.yml restart

# Stop
docker compose -f docker-compose.nas.yml down

# Update (pull latest)
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

---

## Optional: Enable Local AI (Ollama)

For privacy-first AI summarization without cloud APIs:

```bash
# SSH into NAS
ssh your_user@your_nas_ip

# Edit docker-compose.nas.yml
# Uncomment the ollama section

# Start Ollama
docker compose -f docker-compose.nas.yml up -d ollama

# Install model (run this inside the container)
docker exec -it rss-deck-ollama ollama pull llama3.2
```

Then in RSS Deck Settings:
- Provider: Ollama
- URL: http://ollama:11434 (internal Docker network)
- Model: llama3.2

---

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3005
sudo lsof -i :3005

# Change port in docker-compose.nas.yml
```

### Container Won't Start

```bash
# Check logs
docker compose -f docker-compose.nas.yml logs
```

### Can't Access from Network

1. Check NAS firewall settings
2. Ensure port 3005 is allowed
3. Try accessing from another device

---

## Backup & Restore

### Backup Settings

```bash
docker volume inspect rss-deck-data
# Settings are in the Mountpoint path
```

### Transfer to Another NAS

1. Export Docker image:
   ```bash
   docker save rss-deck:latest > rss-deck.tar
   ```
2. Copy tar file and project files to new NAS
3. Load and deploy:
   ```bash
   docker load -i rss-deck.tar
   ```

---

## Access from Internet (Optional)

**Recommended: Use Synology QuickConnect**

1. Enable QuickConnect in DSM Control Panel
2. Access via: `http://quickconnect.to/your_id/rss-deck`

**Alternative: Port Forward (Security Risk)**

1. Router → Port forward 3005 to NAS IP
2. Access via: `http://your_public_ip:3005`

⚠️ **Security Warning:** Exposing directly to internet is risky. Use VPN or QuickConnect instead.
