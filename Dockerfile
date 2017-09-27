FROM node:6

COPY . /opt/service/
WORKDIR /opt/service

RUN npm rebuild
RUN rm config.js
RUN mv config.prod.js config.js
RUN npm run build-fe-prod
RUN npm run build-server
RUN npm prune --production

EXPOSE 8080

ENTRYPOINT ["npm", "run", "start-server", "--"]