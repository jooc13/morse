# Build stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install --silent

COPY public/ public/
COPY src/ src/
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dependencies for the production server
COPY server-package.json ./package.json
RUN npm install --production

# Copy the built React app
COPY --from=build /app/build ./build
COPY server.js .

EXPOSE 3001

CMD ["node", "server.js"]