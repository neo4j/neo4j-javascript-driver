FROM ubuntu:18.04

RUN apt-get update && \
    apt-get install -y \
        git \
        curl \
        python3 \
        firefox \
        nodejs \
        npm \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm \
    && /bin/bash -c 'hash -d npm'
RUN npm install -g gulp

# Install our own CAs on the image.
# Assumes Linux Debian based image.
COPY CAs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates
