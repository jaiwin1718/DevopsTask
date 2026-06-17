# Dockerfile
# Builds a small production-like image for the Node.js app.

FROM node:20-alpine

# Create and use a dedicated app directory
WORKDIR /usr/src/app

# Install dependencies first so Docker can cache this layer when only
# source code changes (faster rebuilds).
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application source
COPY . .

# Document the port the app listens on
EXPOSE 3000

# Run the app
CMD ["node", "server.js"]
