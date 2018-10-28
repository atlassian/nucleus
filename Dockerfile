FROM node:8

RUN apt update && apt install createrepo dpkg-dev apt-utils gnupg2 gzip -y && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/service

# Copy PJ, changes should invalidate entire image
COPY package.json yarn.lock /opt/service/


# Copy commong typings
COPY typings /opt/service/typings

# Copy TS configs
COPY tsconfig* /opt/service/

# Build backend
COPY src /opt/service/src

# Build Frontend

COPY public /opt/service/public
COPY webpack.*.js postcss.config.js README.md /opt/service/

# Install dependencies
RUN yarn --cache-folder ../ycache && yarn build:server && yarn build:fe:prod && yarn --production --cache-folder ../ycache && rm -rf ../ycache

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start:server:prod", "--"]