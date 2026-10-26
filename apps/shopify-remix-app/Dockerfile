FROM node:24-alpine
RUN apk add --no-cache openssl ffmpeg
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./

RUN npm ci --include=dev && npm cache clean --force

COPY . .

RUN npx prisma generate && npm run build && npm prune --omit=dev

CMD ["npm", "run", "docker-start"]
