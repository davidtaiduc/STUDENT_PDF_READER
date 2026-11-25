FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY scripts/sync-pdfjs-assets.mjs scripts/sync-pdfjs-assets.mjs
RUN npm ci
COPY . .
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production WEB_HOST=0.0.0.0 WEB_PORT=8080
COPY --from=build /app/package*.json ./
COPY --from=build /app/scripts ./scripts
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=build /app/backend ./backend
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||process.env.WEB_PORT||8080)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["npm","start"]
