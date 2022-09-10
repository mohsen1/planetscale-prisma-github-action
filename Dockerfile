FROM ubuntu:latest

WORKDIR /

RUN apt-get update && apt-get upgrade -y \
    && apt-get install -y curl wget git \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
RUN apt install -y nodejs
RUN wget "https://github.com/planetscale/cli/releases/download/v0.115.0/pscale_0.115.0_linux_$(dpkg --print-architecture).deb" -O /tmp/pscale.deb && \
    dpkg -i /tmp/pscale.deb && \
    rm /tmp/pscale.deb


USER root

COPY . /
RUN npm install

ENTRYPOINT [ "/index.js" ]