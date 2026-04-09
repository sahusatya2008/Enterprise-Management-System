FROM node:20-alpine

WORKDIR /app/services/sales-service

COPY services/sales-service/package.json ./
RUN npm install

COPY services/sales-service/tsconfig.json ./
COPY services/sales-service/src ./src
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 4104

CMD ["npm", "run", "start"]

