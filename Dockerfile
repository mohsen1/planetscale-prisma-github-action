FROM ubuntu:latest

RUN apt-get install wget -y && \
    wget https://github.com/planetscale/cli/releases/download/v0.115.0/pscale_0.115.0_linux_amd64.deb -O /tmp/pscale.deb && \
    dpkg -i /tmp/pscale.deb && \
    rm /tmp/pscale.deb

COPY index.js /index.js

ENTRYPOINT ["/index.js"]