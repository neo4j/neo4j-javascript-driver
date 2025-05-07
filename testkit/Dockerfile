FROM ubuntu:24.04

ARG NODE_VERSION=18
ARG DENO_VERSION=2.2.11

ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_OPTIONS="--max_old_space_size=4096 --use-openssl-ca"

# Configuring NodeJS version
RUN apt-get clean 

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y curl

RUN curl -sL https://deb.nodesource.com/setup_${NODE_VERSION:-18}.x | bash -

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y \
        git \
        curl \
        python3 \
        nodejs \
        nodejs \
        wget \
        unzip \
    && rm -rf /var/lib/apt/lists/*

RUN install -d -m 0755 /etc/apt/keyrings && \
    wget -q https://packages.mozilla.org/apt/repo-signing-key.gpg -O- | tee /etc/apt/keyrings/packages.mozilla.org.asc > /dev/null && \
    gpg -n -q --import --import-options import-show /etc/apt/keyrings/packages.mozilla.org.asc | awk '/pub/{getline; gsub(/^ +| +$/,""); if($0 == "35BAA0B33E9EB396F59CA838C0BA5CE6DC6315A3") print "\nThe key fingerprint matches ("$0").\n"; else {exit 1}}' && \
    echo "deb [signed-by=/etc/apt/keyrings/packages.mozilla.org.asc] https://packages.mozilla.org/apt mozilla main" | tee -a /etc/apt/sources.list.d/mozilla.list > /dev/null && \
    echo 'Package: *\nPin: origin packages.mozilla.org\nPin-Priority: 1000' | tee /etc/apt/preferences.d/mozilla && \
    apt-get update && apt-get install -y \
        libpci-dev \
        libcanberra-gtk3-module \
        libgles2-mesa-dev \
        dbus-x11 \
        firefox && \
    apt-get clean

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

# Install our own CAs on the image.
# Assumes Linux Debian based image.
COPY CAs/* /usr/local/share/ca-certificates/
# Store custom CAs somewhere where the backend can find them later.
COPY CustomCAs/* /usr/local/share/custom-ca-certificates/

RUN update-ca-certificates --verbose

# Add Deno
RUN curl -fsSL https://deno.land/x/install/install.sh | sh -s v$DENO_VERSION
RUN mv /root/.deno/bin/deno /usr/bin/
# Using System CA in Deno
ENV DENO_TLS_CA_STORE=system

# Creating an user for building the driver and running the tests
RUN useradd -m driver && echo "driver:driver" | chpasswd && adduser driver sudo
VOLUME /driver
RUN chown -Rh driver:driver /home/driver
WORKDIR /home/driver

USER driver
WORKDIR /home/driver
CMD /bin/bash
RUN mkdir /home/driver/.npm_global
RUN npm config set prefix /home/driver/.npm_global


## Versions
RUN node --version
RUN npm --version
RUN deno --version
