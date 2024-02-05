#!/bin/bash

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "Docker does not seem to be running, start Docker first and try again"
    exit 1
fi

# Check if MongoDB container is running
if [ "$(docker ps -q -f name=mongodb)" ]; then
    echo "MongoDB container is already running"
else
    if [ "$(docker ps -aq -f status=exited -f name=mongodb)" ]; then
        # cleanup
        echo "Removing exited MongoDB container"
        docker rm mongodb
    fi
    # run your container
    echo "Starting MongoDB container"
    docker run -d -p 27017:27017 --name mongodb mongo:latest
fi
