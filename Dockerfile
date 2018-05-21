FROM node:8

RUN apt update && apt install createrepo dpkg-dev apt-utils gnupg2 gzip -y

WORKDIR /opt/service

# Copy PJ, changes should invalidate entire image
COPY package.json yarn.lock /opt/service/

# Install dependencies
RUN yarn

# Copy commong typings
COPY typings /opt/service/typings

# Copy TS configs
COPY tsconfig* /opt/service/

# Build backend
COPY src /opt/service/src
RUN yarn build-server

# Build frontend
COPY public /opt/service/public
COPY webpack.*.js postcss.config.js README.md /opt/service/
RUN yarn build-fe-prod

RUN yarn --production

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start-server", "--"]