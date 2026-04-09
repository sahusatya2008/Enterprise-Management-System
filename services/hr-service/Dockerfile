FROM node:20-alpine

WORKDIR /app/services/hr-service

COPY services/hr-service/package.json ./
RUN npm install

COPY services/hr-service/tsconfig.json ./
COPY services/hr-service/src ./src
COPY tsconfig.base.json /app/tsconfig.base.json

RUN npm run build

EXPOSE 4102

CMD ["npm", "run", "start"]

