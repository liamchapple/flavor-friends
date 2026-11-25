FROM node:22-alpine
WORKDIR /app
COPY server.js ./
COPY site ./site
CMD ["node","server.js"]
