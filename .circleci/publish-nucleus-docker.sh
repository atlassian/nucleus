#!/usr/bin/env bash

########################################################################
#                                                                      #
#         This script requires the following env vars set              #
#                                                                      #
# DOCKER_USER: Username with push access to atlassian dockerhub        #
# DOCKER_PASSWORD: Password for user with push access to dockerhub     #
#                                                                      #
########################################################################

# First 8 characters of SHA
export COMMIT=${CIRCLE_SHA1:0:8}
# Docker Hub Repo
export PAC=docker-public.packages.atlassian.com
export REPO=$PAC/atlassian/nucleus
# Target tag, latest on master, branch otherwise
export TAG=`if [ "$CIRCLE_BRANCH" == "master" ]; then echo "latest"; else echo $CIRCLE_BRANCH ; fi`

docker login -u $PAC_DOCKER_USER -p $PAC_DOCKER_PASSWORD $PAC
docker build -f Dockerfile -t $REPO:$COMMIT .
docker tag $REPO:$COMMIT $REPO:$TAG
docker tag $REPO:$COMMIT $REPO:circle-$CIRCLE_BUILD_NUM
docker push $REPO