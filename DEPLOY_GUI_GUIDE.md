# RSS Deck - Synology NAS Deployment Guide

## Current Status
- **NAS IP**: 192.168.68.57
- **Synology Username**: kianfong
- **SSH Status**: Not accessible (Connection refused on port 22)
- **Deployment Method**: Docker GUI (Container Manager)

---

## Prerequisites

1. **Synology NAS** with Docker installed (Container Manager app)
2. Files synced via Synology Drive to: `/volume1/docker/rss-deck/`
3. Access to Synology DSM web interface

---

## Step 1: Verify Files on NAS

1. Open **File Station** on DSM
2. Navigate to `/volume1/docker/`
3. Verify these files are present:
   - `docker-compose.nas.yml`
   - `Dockerfile`
   - `package.json`
   - All source folders (app, components, lib, etc.)

**If files are not there:**
- Wait for Synology Drive sync to complete
- Or manually upload via File Station from your Mac

---

## Step 2: Open Container Manager

1. Log into DSM web interface: `http://192.168.68.57:5000`
2. Open **Container Manager** (or Docker)
3. Go to **Project** → **Create**

---

## Step 3: Create Project

1. **Project path**: Select `/volume1/docker/rss-deck/`
2. **Compose file**: Choose `docker-compose.nas.yml`
3. **Configuration**:
   - **Project name**: `rss-deck`
   - **Network mode**: Bridge
   - **Port mapping**: 3005:3000
   - **Enable auto-restart**: ✓
4. Click **Next** → **Done**

---

## Step 4: Build & Deploy

Container Manager will automatically:
- Build the Docker image from Dockerfile
- Create the container
- Start the service

**Manual build (if needed):**
```bash
# SSH into NAS (enable first in DSM → Control Panel → Terminal & SNMP)
ssh kianfong@192.168.68.57
cd /volume1/docker/rss-deck
docker compose -f docker-compose.nas.yml build
docker compose -f docker-compose.nas.yml up -d
```

---

## Step 5: Verify Deployment

1. Check **Container** tab for `rss-deck` status (should be Running)
2. Check **Logs** for any errors
3. Access RSS Deck: `http://192.168.68.57:3005`

---

## Configuration Notes

### Gemini API Key
After deployment, enter in RSS Deck Settings:
- **Provider**: Google Gemini
- **API Key**: `AIzaSyA7C1YNdCradXz8osEEwV6tr8QF4upijsU`

### Port
Default port is **3005**. Change in docker-compose.nas.yml if needed:
```yaml
ports:
  - "YOUR_PORT:3000"  # e.g., "8080:3000"
```

### Timezone
Already configured: `Asia/Kuala_Lumpur`

### Data Persistence
Settings stored in Docker volume `rss-deck-data`

---

## Management

### Via Docker GUI
- **Start/Stop**: Container Manager → rss-deck → Actions
- **Logs**: Container Manager → rss-deck → Logs
- **Restart**: Actions → Restart

### Via SSH (if enabled)
```bash
# View logs
docker compose -f docker-compose.nas.yml logs -f

# Restart
docker compose -f docker-compose.nas.yml restart

# Stop
docker compose -f docker-compose.nas.yml down

# Update
docker compose -f docker-compose.nas.yml pull
docker compose -f docker-compose.nas.yml up -d
```

---

## Troubleshooting

### Container Won't Start
1. Check logs in Container Manager
2. Common issues:
   - Port 3005 already in use
   - Missing environment variables
   - Volume permission issues

### Can't Access from Network
1. Check NAS firewall settings (Control Panel → Security → Firewall)
2. Ensure port 3005 is allowed
3. Try accessing from another device on same network

### Enable SSH (Optional)
1. DSM → Control Panel → Terminal & SNMP
2. Enable SSH service
3. Use port 22 or custom port

---

## Success Criteria
- [ ] Container `rss-deck` shows Running status
- [ ] RSS Deck loads at `http://192.168.68.57:3005`
- [ ] Settings persist after container restart

---

## Deployment Date
**2026-02-02 08:50 AM (GMT+8)**
