# Stage 1: Build the React client
FROM node:20-alpine AS client-builder
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Stage 2: Production Server
FROM node:20-alpine
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Copy server files & install production dependencies
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./

# Copy built frontend assets from client-builder
COPY --from=client-builder /app/client/dist /app/client/dist

# Expose server port
EXPOSE 3001

# Start the production server
CMD ["node", "index.js"]
