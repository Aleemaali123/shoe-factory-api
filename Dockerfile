FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY data ./data

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATABASE_PATH=data/shop.db

EXPOSE 8080

CMD ["npm", "start"]
