FROM ubuntu:20.04

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update && \
    apt-get install -y \
        git \
        curl \
        python3 \
        nodejs \
        npm \ 
        firefox \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm \
    && /bin/bash -c 'hash -d npm'
RUN npm install -g gulp

# Enable tls v1.0
RUN echo "openssl_conf = openssl_configuration\n"|cat - /etc/ssl/openssl.cnf > /tmp/openssl_conf.cnf \  
    && mv /tmp/openssl_conf.cnf /etc/ssl/openssl.cnf  
RUN echo "[openssl_configuration]\n\
ssl_conf = ssl_configuration\n\
[ssl_configuration]\n\
system_default = tls_system_default\n\
[tls_system_default]\n\
CipherString = DEFAULT:@SECLEVEL=1" >> /etc/ssl/openssl.cnf 

# Install our own CAs on the image.
# Assumes Linux Debian based image.
COPY CAs/* /usr/local/share/ca-certificates/
RUN update-ca-certificates
