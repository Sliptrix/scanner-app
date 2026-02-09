FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json backend/
RUN cd backend && npm ci --production
COPY . .
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "backend/server.js"]
