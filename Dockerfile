FROM ubuntu:latest

WORKDIR /

RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y nodejs npm wget \
    && rm -rf /var/lib/apt/lists/*
RUN wget "https://github.com/planetscale/cli/releases/download/v0.115.0/pscale_0.115.0_linux_$(dpkg --print-architecture).deb" -O /tmp/pscale.deb && \
    dpkg -i /tmp/pscale.deb && \
    rm /tmp/pscale.deb


COPY index.js /index.js
COPY package.json /package.json
COPY package-lock.json /package-lock.json


CMD [ "npm", "start" ]