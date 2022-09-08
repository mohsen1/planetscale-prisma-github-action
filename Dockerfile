FROM ubuntu:latest
RUN  apt-get update \
    && apt-get install -y wget \
    && apt-get install -y nodejs \
    && apt-get install -y yarn \
    && rm -rf /var/lib/apt/lists/*
RUN wget "https://github.com/planetscale/cli/releases/download/v0.115.0/pscale_0.115.0_linux_$(dpkg --print-architecture).deb" -O /tmp/pscale.deb && \
    dpkg -i /tmp/pscale.deb && \
    rm /tmp/pscale.deb

COPY index.js /index.js

RUN yarn install

ENTRYPOINT ["/index.js"]