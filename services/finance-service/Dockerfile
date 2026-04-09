FROM node:20-alpine

WORKDIR /app/services/finance-service

COPY services/finance-service/package.json ./
RUN npm install

COPY services/finance-service/tsconfig.json ./
COPY services/finance-service/src ./src
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 4103

CMD ["npm", "run", "start"]

