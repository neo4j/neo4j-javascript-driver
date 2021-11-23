FROM ubuntu:20.04

ENV DEBIAN_FRONTEND noninteractive
ENV NODE_OPTIONS --max_old_space_size=4096

RUN apt-get update && \
    apt-get install -y \
        git \
        curl \
        python3 \
        nodejs \
        npm \
        firefox \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g npm@7 \
    && /bin/bash -c "hash -d npm"

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
# Store custom CAs somewhere where the backend can find them later.
COPY CustomCAs/* /usr/local/share/custom-ca-certificates/
RUN update-ca-certificates

# Creating an user for building the driver and running the tests
RUN useradd -m driver && echo "driver:driver" | chpasswd && adduser driver sudo
VOLUME /driver
RUN chown -Rh driver:driver /driver
USER driver
WORKDIR /home/driver
CMD /bin/bash
RUN mkdir /home/driver/.npm_global
RUN npm config set prefix /home/driver/.npm_global
