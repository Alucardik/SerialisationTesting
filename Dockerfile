FROM node:15

WORKDIR /serialization-test

COPY src ./src
COPY protobufs ./protobufs
COPY avro ./avro
COPY *.json ./

RUN npm ci
CMD node src/index.js
