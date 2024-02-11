#!/bin/bash

# Set container command based on what's installed
CONTAINER_CMD=""
if command -v docker &>/dev/null; then
  CONTAINER_CMD="docker"
elif command -v podman &>/dev/null; then
  CONTAINER_CMD="podman"
else
  echo "Neither Docker nor Podman found. Please install one of them."
  exit 1
fi

# Check if MongoDB container is running
if [ "$($CONTAINER_CMD ps -q -f name=mongodb)" ]; then
  echo "MongoDB container is already running"
else
  if [ "$($CONTAINER_CMD ps -aq -f status=exited -f name=mongodb)" ]; then
    # cleanup
    echo "Removing exited MongoDB container"
    $CONTAINER_CMD rm mongodb
  fi
  # run your container
  echo "Starting MongoDB container"
  $CONTAINER_CMD run -d -p 27017:27017 --name mongodb mongo:latest
fi
