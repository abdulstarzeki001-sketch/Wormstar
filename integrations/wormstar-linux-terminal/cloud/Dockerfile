FROM node:20-bookworm

# Userland tools the terminal and the AI command allowlist rely on.
# build-essential + python3 are needed to compile node-pty.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates git curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user. NO sudo is installed: unlike the standalone linux-terminal
# image, this backend must not grant root, so the deployment container itself
# stays the isolation boundary.
RUN useradd -m -s /bin/bash tuser

WORKDIR /app
COPY package.json ./
ENV npm_config_nodedir=/usr/local
RUN npm install --omit=dev

COPY server.js ./

# Confined, writable working directory for shell and AI commands.
RUN mkdir -p /home/tuser/workspace && chown -R tuser:tuser /app /home/tuser
USER tuser
ENV HOME=/home/tuser
ENV TERMINAL_WORKSPACE=/home/tuser/workspace
WORKDIR /home/tuser

EXPOSE 8080
CMD ["node", "/app/server.js"]
