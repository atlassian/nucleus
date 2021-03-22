#!/bin/bash

set -e

if [[ -z "$1" ]] ; then
    echo "Arguments of environment required."
    exit 1
fi

case $1 in
    tfdev) target_account_id=369862142687 ;;
    prod) target_account_id=795400190015 ;;
esac

case $1 in
    tfdev) ecr_account_id=369862142687 ;;
    prod) ecr_account_id=334803245014 ;;
esac

if [[ -z "$target_account_id" ]] ; then
    echo "Environment must be one of tfdev, prod"
    exit 1
fi

aws sts get-caller-identity | grep -q $target_account_id
if [[ ! $? ]] ; then
    exit 1
fi

echo "Deploying locally built nucleus:latest to AWS account $1 ($target_account_id)"

aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin $ecr_account_id.dkr.ecr.us-east-2.amazonaws.com

docker tag nucleus:latest $ecr_account_id.dkr.ecr.us-east-2.amazonaws.com/nucleus:$1
docker push $ecr_account_id.dkr.ecr.us-east-2.amazonaws.com/nucleus:$1

echo "Done pushing to Docker"

aws ecs update-service --cluster nucleus-cluster --service nucleus-service --force-new-deployment --region us-east-2
