#!/bin/sh


# Run Prisma migrations
npx prisma migrate dev --name init

npx prisma db seed
# Start the application
npm run start:dev