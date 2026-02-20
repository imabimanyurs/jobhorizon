# ─── Build stage: Node + Python in one image ───
FROM node:20-slim AS base

# Install Python 3
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip python3-venv && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3 /usr/bin/python

WORKDIR /app

# ─── Python dependencies ───
COPY scraper/requirements.txt /app/scraper/requirements.txt
RUN pip3 install --break-system-packages --no-cache-dir -r /app/scraper/requirements.txt

# ─── Node dependencies ───
COPY web/package*.json /app/web/
RUN cd /app/web && npm ci --omit=dev --legacy-peer-deps

# ─── Copy all source ───
COPY . /app/

# ─── Build Next.js ───
RUN cd /app/web && npm run build

# ─── Data directory (Railway Volume mounts here) ───
RUN mkdir -p /app/data

# ─── Expose port ───
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# ─── Start Next.js ───
CMD ["npm", "run", "start", "--prefix", "/app/web"]
