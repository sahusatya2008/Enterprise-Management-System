FROM node:20-alpine

WORKDIR /app/backend

COPY backend/package.json ./
RUN npm install

COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 4000

CMD ["npm", "run", "start"]

