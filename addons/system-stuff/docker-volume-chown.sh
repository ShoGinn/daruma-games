#!/usr/bin/env bash

# Check if sudo is installed
if command -v sudo &>/dev/null; then
    SUDO="sudo"
else
    SUDO=""
fi

VOLUME="$1"
UID_GID="$2"

if [[ -z "$VOLUME" || -z "$UID_GID" ]]; then
    echo "Usage:"
    echo "  This script changes the ownership of all items in a Docker volume."
    echo ""
    echo "  $0 VOLUME UID:GID"
    echo "    VOLUME   - Name of the Docker volume."
    echo "    UID:GID  - User ID and Group ID to set as owner."
    echo ""
    echo "Example:"
    echo "  Change ownership of all items in volume 'myvol' to uid 1000 and gid 1000:"
    echo "    $0 myvol 1000:1000"
    exit 1
fi

# Create a temporary Docker container with the volume mounted
$SUDO docker container create --name docker_volume_chown -v "$VOLUME":/volume hello-world

# Change ownership of all items in the volume
$SUDO docker run --rm --volumes-from docker_volume_chown --user root busybox chown -R "$UID_GID" /volume

# Remove the temporary container
$SUDO docker rm docker_volume_chown
