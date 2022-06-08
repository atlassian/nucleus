set -e

docker build -f Dockerfile --platform linux/amd64 --tag nucleus .
