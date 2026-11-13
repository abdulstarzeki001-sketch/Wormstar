FROM node:20-bookworm

# Everyday shell tools. build-essential + python3 also compile node-pty.
# `setpriv` (util-linux, already in the base image) performs the privilege drop.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 build-essential ca-certificates git curl nano less \
    && rm -rf /var/lib/apt/lists/*

# Unprivileged shell user. NO sudo is installed.
RUN useradd -m -s /bin/bash tuser \
    && mkdir -p /home/tuser/workspace \
    && chown -R tuser:tuser /home/tuser

WORKDIR /app
COPY package.json package-lock.json ./
ENV npm_config_nodedir=/usr/local
RUN npm ci --omit=dev

COPY server.js ./

# The server intentionally stays root: it needs that only to launch every shell
# through `setpriv` as `tuser` with groups cleared, all capabilities dropped and
# no-new-privileges set. Root-owned /app and the server's environment (the
# access token) are therefore out of the shell's reach. Do not add a USER line:
# with a shared UID the service refuses to start.
ENV TERMINAL_RUN_AS=tuser
ENV TERMINAL_WORKSPACE=/home/tuser/workspace

EXPOSE 8080
CMD ["node", "/app/server.js"]
