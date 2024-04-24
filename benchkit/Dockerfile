FROM ubuntu:20.04

ARG NODE_VERSION=16
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_OPTIONS --max_old_space_size=4096 --use-openssl-ca

# Configuring NodeJS version
RUN apt-get clean 

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y curl

RUN curl -sL https://deb.nodesource.com/setup_${NODE_VERSION:=10}.x | bash -

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
        git \
        curl \
        python3 \
        nodejs \
        firefox \
        wget \
        nodejs \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN /bin/bash -c "hash -d npm"

# Enable tls v1.0
RUN echo "openssl_conf = openssl_configuration\n"|cat - /etc/ssl/openssl.cnf > /tmp/openssl_conf.cnf \
    && mv /tmp/openssl_conf.cnf /etc/ssl/openssl.cnf
RUN echo "[openssl_configuration]\n\
ssl_conf = ssl_configuration\n\
[ssl_configuration]\n\
system_default = tls_system_default\n\
[tls_system_default]\n\
CipherString = DEFAULT:@SECLEVEL=1" >> /etc/ssl/openssl.cnf

RUN update-ca-certificates --verbose

RUN useradd -m driver && echo "driver:driver" | chpasswd && adduser driver sudo
VOLUME /driver
RUN chown -Rh driver:driver /home/driver

USER driver
WORKDIR /home/driver
CMD /bin/bash
RUN mkdir /home/driver/.npm_global
RUN npm config set prefix /home/driver/.npm_global

# Build stuff
ADD --chown=driver:driver . /home/driver

RUN ls -lf ..
RUN npm ci 
RUN npm run build 

CMD ["npm", "run", "start-benchkit-backend"]