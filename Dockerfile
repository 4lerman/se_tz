FROM node:21

RUN apt-get update && apt-get install -y openssl

WORKDIR /usr/src/app

COPY --chown=node:node package*.json ./

RUN npm ci

COPY prisma ./prisma/

COPY --chown=node:node . .

COPY .env.docker ./

RUN npx prisma generate

RUN npm run build

COPY entrypoint.sh ./

RUN chmod +x ./entrypoint.sh

EXPOSE 3000

CMD [ "./entrypoint.sh" ]