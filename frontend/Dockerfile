FROM node:20-alpine

WORKDIR /app/frontend

COPY frontend/package.json ./
RUN npm install

COPY frontend/tsconfig.json ./
COPY frontend/next-env.d.ts ./
COPY frontend/next.config.ts ./
COPY frontend/postcss.config.js ./
COPY frontend/tailwind.config.ts ./
COPY frontend/app ./app
COPY frontend/components ./components
COPY frontend/lib ./lib
COPY frontend/types ./types
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]

