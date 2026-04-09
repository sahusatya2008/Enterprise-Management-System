FROM node:20-alpine

WORKDIR /app/services/inventory-service

COPY services/inventory-service/package.json ./
RUN npm install

COPY services/inventory-service/tsconfig.json ./
COPY services/inventory-service/src ./src
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 4101

CMD ["npm", "run", "start"]

