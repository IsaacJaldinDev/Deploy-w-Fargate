# ─────────────────────────────────────────────────────────────────────────────
# STAGE 1: builder
#
# This stage installs Node.js and the Angular CLI, installs npm dependencies,
# and compiles the Angular application to static files (HTML, CSS, JS).
#
# The entire stage is DISCARDED after the build. The final production image
# contains no Node.js, no npm, no Angular source code — just the compiled
# static files and the Nginx web server.
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-alpine AS builder

# Set working directory for all subsequent commands
WORKDIR /app

# Copy dependency files before source code (layer caching optimization).
# If package.json and package-lock.json haven't changed, Docker reuses
# the cached npm install layer — making rebuilds significantly faster.
COPY package*.json ./

# Install all dependencies (including devDependencies like @angular/cli).
# npm ci uses the lockfile for reproducible, deterministic installs.
RUN npm ci

# Copy the rest of the Angular project files
COPY . .

# BUILD_CONFIGURATION controls which Angular environment file is used:
#   - "production"  → environment.prod.ts (AWS ALB URL) — used by CI/CD pipeline
#   - "development" → environment.ts      (localhost:3000) — used by docker-compose
#
# docker-compose.yml passes BUILD_CONFIGURATION=development via build.args.
# The CI/CD pipeline omits it, so it defaults to "production" here.
#
# --configuration=production also enables AOT compilation, tree-shaking,
# minification, and output hashing (e.g., main.a3f8b9c1.js).
ARG BUILD_CONFIGURATION=production
RUN npm run build -- --configuration=${BUILD_CONFIGURATION}

# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2: production (Nginx)
#
# Start fresh from the official Nginx image (Alpine Linux variant — ~25MB).
# We copy only the compiled static files from the builder stage.
#
# The final image:
#   - Contains no Node.js, no npm, no source code, no Angular CLI
#   - Weighs ~25MB instead of ~400MB for the builder stage
#   - Serves static files extremely efficiently with Nginx
#   - Handles Angular's client-side routing (see nginx.conf)
# ─────────────────────────────────────────────────────────────────────────────
FROM --platform=linux/amd64 nginx:alpine AS production

# Remove Nginx's default "Welcome to nginx" HTML files.
# We'll replace them with our compiled Angular app.
RUN rm -rf /usr/share/nginx/html/*

# Copy the compiled Angular output from the builder stage.
# Angular 17+ (with the application builder) outputs to dist/<project>/browser/
# The project name "web" matches the "projects" key in angular.json.
COPY --from=builder /app/dist/web/browser /usr/share/nginx/html

# Replace Nginx's default configuration with our custom one.
# The custom config handles:
#   - Angular client-side routing (try_files → index.html)
#   - Gzip compression for JS bundles
#   - Long-term caching for hashed assets
#   - No-cache for index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Document that Nginx listens on port 80.
# The ECS Task Definition must map this to a host port.
EXPOSE 80

# Run Nginx in the foreground.
# "daemon off" prevents Nginx from backgrounding itself, which would cause
# the container to exit immediately (Docker expects PID 1 to stay in foreground).
# This is the correct way to run Nginx in a Docker container.
CMD ["nginx", "-g", "daemon off;"]
