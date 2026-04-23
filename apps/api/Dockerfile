# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: builder
#
# This stage installs ALL dependencies (including devDependencies like TypeScript
# and ts-node) and compiles the TypeScript source to JavaScript.
#
# This entire stage is DISCARDED after the build. The final production image
# never contains the TypeScript compiler, source maps, or devDependencies.
# This is the "multi-stage build" pattern — smaller, more secure images.
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-alpine AS builder

# Set the working directory inside the container.
# All subsequent COPY, RUN, and CMD commands are relative to this path.
WORKDIR /app

# Copy package files BEFORE copying source code.
# Docker builds in layers — each instruction is a cached layer.
# By copying package.json and package-lock.json first, Docker can reuse
# the npm install layer if source code changes but dependencies don't.
# This makes subsequent builds much faster.
COPY package*.json ./

# npm ci (clean install) — installs exact versions from package-lock.json.
# More reliable than npm install for CI/CD environments.
# Installs ALL dependencies including devDependencies (TypeScript, ts-node, etc.)
# because we need them for the build step below.
RUN npm ci

# Copy the TypeScript configuration
COPY tsconfig.json ./

# Copy all source code
COPY src/ ./src/

# Compile TypeScript → JavaScript.
# Output goes to dist/ (configured in tsconfig.json "outDir": "./dist")
# After this step, dist/ contains pure JavaScript that Node.js can run natively.
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: production
#
# Start completely fresh from the same slim Node.js base image.
# We copy ONLY what we need to run the app:
#   - Production node_modules (no TypeScript compiler, no @types/*, no ts-node)
#   - The compiled JavaScript in dist/
#
# Result: a ~120MB image instead of ~400MB.
# No TypeScript source code, no compiler, no devDependencies in the final image.
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-alpine AS production

WORKDIR /app

# Copy package files for the production install
COPY package*.json ./

# Install ONLY production dependencies.
# --omit=dev skips devDependencies (typescript, ts-node, @types/*, nodemon, etc.)
# This is what makes the final image so much smaller than the builder stage.
RUN npm ci --omit=dev

# Copy the compiled JavaScript from the builder stage.
# The --from=builder flag references the previous stage by its alias name.
COPY --from=builder /app/dist ./dist

# Document which port the app listens on.
# This is metadata only — it doesn't actually expose the port.
# The ECS Task Definition and Security Groups control actual network access.
EXPOSE 3000

# Build argument for the git commit SHA — passed by the CI/CD pipeline:
#   docker build --build-arg GIT_COMMIT_SHA=${{ github.sha }} ...
# The ARG makes it available during build time, and ENV bakes it into the image
# as a runtime environment variable so process.env.GIT_COMMIT_SHA works.
ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=${GIT_COMMIT_SHA}

# IMPORTANT: Use exec form (JSON array), NOT shell form (plain string).
#
# Shell form:  CMD node dist/index.js
#   → runs as: /bin/sh -c "node dist/index.js"
#   → sh is PID 1, node is a child process
#   → SIGTERM goes to sh, which does NOT forward it to node
#   → graceful shutdown (process.on('SIGTERM')) never runs
#   → ECS has to wait for the stop timeout (30s) before force-killing
#
# Exec form:   CMD ["node", "dist/index.js"]
#   → node is PID 1 directly
#   → SIGTERM goes straight to node
#   → graceful shutdown runs, connections close cleanly
#   → ECS considers the task stopped gracefully (exit 0)
CMD ["node", "dist/index.js"]
