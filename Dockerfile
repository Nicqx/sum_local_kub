FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY public /app/public
COPY server.js /app/

RUN chown -R node:node /app
USER 1000:1000

EXPOSE 8080

CMD ["node", "server.js"]
