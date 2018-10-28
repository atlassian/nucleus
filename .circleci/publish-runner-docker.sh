#!/usr/bin/env bash

########################################################################
#                                                                      #
#         This script requires the following env vars set              #
#                                                                      #
# DOCKER_USER: Username with push access to atlassian dockerhub        #
# DOCKER_PASSWORD: Password for user with push access to dockerhub     #
#                                                                      #
########################################################################

# Please note that updating this file from a fork will not have any affect
# the runner is built during the build and can't be published from fork PRs

if [[ -z "${DOCKER_PASSWORD}" ]]; then
  echo No docker creds set, skipping the runner build
  exit 0
fi

# First 8 characters of SHA
export COMMIT=${CIRCLE_SHA1:0:8}
# Docker Hub Repo
export REPO=samatlassian/nucleus-ci-runner

cd .circleci
docker login -u $DOCKER_USER -p $DOCKER_PASSWORD
docker build -f Dockerfile -t $REPO:$COMMIT .
docker tag $REPO:$COMMIT $REPO:latest
docker push $REPO
