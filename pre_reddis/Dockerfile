FROM node:14-alpine

WORKDIR /app

COPY public /app/public
COPY server.js /app/

RUN npm install express

EXPOSE 8080

CMD ["node", "server.js"]
