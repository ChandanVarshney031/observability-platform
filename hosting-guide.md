# 🚀 Hosting Guide — Observability Platform

## Recommended: AWS EC2 (Free Tier)

This is the best option for a portfolio project — you get a **live public URL** for free for 12 months.

---

## Part 1 — Launch an EC2 Instance

1. Go to [AWS Console](https://console.aws.amazon.com) → **EC2** → **Launch Instance**
2. Configure it:
   - **Name**: `observability-platform`
   - **AMI**: Ubuntu Server 24.04 LTS (Free tier eligible) ✅
   - **Instance type**: `t2.micro` (Free tier eligible) ✅
   - **Key pair**: Create new → name it `obs-key` → download the `.pem` file → **save it safely**
3. **Network settings** → Edit → Add these inbound rules:
   | Type | Port | Source |
   |---|---|---|
   | SSH | 22 | My IP |
   | Custom TCP | 3000 | 0.0.0.0/0 (api-gateway) |
   | Custom TCP | 4000 | 0.0.0.0/0 (query-api) |
   | Custom TCP | 8080 | 0.0.0.0/0 (dashboard) |
4. **Storage**: Set to **20 GB** (free tier gives you 30GB)
5. Click **Launch Instance**

> ⚠️ t2.micro has only 1GB RAM. Kafka + ClickHouse + Ollama all together is too heavy.
> **Do NOT run Ollama on t2.micro.** Disable the `trace-analyser` service (comment it out in docker-compose).

---

## Part 2 — Connect to Your EC2 Instance

On **Windows**, open PowerShell and run:

```powershell
# Navigate to where you saved your .pem key
cd C:\Users\YourName\Downloads

# Fix permissions (required for SSH)
icacls obs-key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"

# SSH into the instance (replace with your EC2 Public IP)
ssh -i obs-key.pem ubuntu@<YOUR-EC2-PUBLIC-IP>
```

You'll find your **Public IP** in the EC2 Console → Instances → your instance → **Public IPv4 address**.

---

## Part 3 — Install Docker on the EC2 Instance

Run these commands **inside your EC2 terminal**:

```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sudo sh

# Add your user to the docker group (so you don't need sudo every time)
sudo usermod -aG docker ubuntu

# Apply group change without logging out
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify
docker --version
docker compose version
```

---

## Part 4 — Upload Your Project to the Server

**Option A — From Git (Recommended)**

If your project is on GitHub:
```bash
# On the EC2 instance
git clone https://github.com/your-username/observability-platform.git
cd observability-platform
```

**Option B — Copy from your Windows machine**

Run this from your **local Windows PowerShell**:
```powershell
scp -i obs-key.pem -r D:\projects\observability-platform ubuntu@<YOUR-EC2-PUBLIC-IP>:~/
```

---

## Part 5 — Configure Environment Variables

On the EC2 instance:
```bash
cd ~/observability-platform/infra

# Create your .env file
nano .env
```

Paste your values:
```env
GROQ_API_KEY=gsk_your_actual_key_here
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_secret
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

Save with `Ctrl+O`, `Enter`, `Ctrl+X`.

---

## Part 6 — Disable Ollama/trace-analyser (Required for t2.micro)

Edit the docker-compose to comment out the heavy services:
```bash
nano ~/observability-platform/infra/docker-compose.yml
```

Comment out the `trace-analyser` service by adding `#` before each line, or just remove it.

---

## Part 7 — Start the Stack

```bash
cd ~/observability-platform/infra

# Start everything in detached mode
docker compose up -d

# Watch the startup logs
docker compose ps
```

Wait 2–3 minutes for all services to become healthy.

---

## Part 8 — Start the Load Generator

```bash
# Make it executable
chmod +x ~/observability-platform/infra/load-gen.sh

# Run in background (keeps generating traffic even after you disconnect)
nohup bash ~/observability-platform/infra/load-gen.sh > /tmp/load-gen.log 2>&1 &
echo "Load gen PID: $!"
```

---

## Part 9 — Access Your Live Platform

| Service | URL |
|---|---|
| 🖥️ Dashboard | `http://<YOUR-EC2-PUBLIC-IP>:8080` |
| 📡 API Gateway | `http://<YOUR-EC2-PUBLIC-IP>:3000` |
| 🔌 Query API | `http://<YOUR-EC2-PUBLIC-IP>:4000` |

---

## Part 10 — Keep it Running After SSH Disconnect

The `docker compose up -d` already runs in the background. But to make Docker start automatically on instance reboot:

```bash
# Enable Docker to start on boot
sudo systemctl enable docker

# Make docker-compose auto-start on reboot
sudo nano /etc/systemd/system/observability.service
```

Paste this:
```ini
[Unit]
Description=Observability Platform
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/home/ubuntu/observability-platform/infra
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
User=ubuntu

[Install]
WantedBy=multi-user.target
```

Then enable it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable observability
```

---

## Useful Management Commands (on EC2)

```bash
# Check status of all containers
docker compose -f ~/observability-platform/infra/docker-compose.yml ps

# View logs of a specific service
docker compose -f ~/observability-platform/infra/docker-compose.yml logs query-api --tail=50

# Stop everything
docker compose -f ~/observability-platform/infra/docker-compose.yml down

# Restart a single service
docker compose -f ~/observability-platform/infra/docker-compose.yml restart query-api

# Check how many spans are in ClickHouse
docker compose -f ~/observability-platform/infra/docker-compose.yml exec clickhouse \
  clickhouse-client --password password --query "SELECT count() FROM traces"
```

---

## Free Tier Limits to Watch

| Resource | Free Tier Limit |
|---|---|
| EC2 compute | 750 hours/month of t2.micro |
| EBS storage | 30 GB |
| Data transfer out | 100 GB/month |
| Duration | **12 months** from AWS signup |

> **Stop your instance when not using it** to save your 750 free hours.
> EC2 Console → Select instance → Instance state → **Stop**.

---

## Alternative: Rent a $4/month VPS (No 12-month limit)

If you want something permanent and cheap:

| Provider | Plan | Cost | RAM |
|---|---|---|---|
| [Hetzner](https://hetzner.com) | CX22 | ~$4/mo | 4GB ⭐ |
| [DigitalOcean](https://digitalocean.com) | Basic Droplet | $6/mo | 1GB |
| [Vultr](https://vultr.com) | Cloud Compute | $6/mo | 1GB |

**Hetzner CX22 is strongly recommended** — 4GB RAM handles Kafka + ClickHouse comfortably and costs less than AWS.

Setup is identical — install Docker, clone repo, run `docker compose up -d`.
