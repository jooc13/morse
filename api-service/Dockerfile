FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init

COPY package*.json ./

RUN npm install --only=production && npm cache clean --force

COPY src/ src/

RUN mkdir -p uploads && chown -R node:node uploads

USER node

EXPOSE 3000

CMD ["dumb-init", "node", "src/app.js"]