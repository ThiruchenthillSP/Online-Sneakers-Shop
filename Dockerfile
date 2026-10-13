FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
ENV NODE_ENV=production PORT=8091 DB_PATH=/app/data/sneaker-shop.db
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 8091
HEALTHCHECK --interval=20s --timeout=3s --start-period=5s CMD node -e "fetch('http://127.0.0.1:8091/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
