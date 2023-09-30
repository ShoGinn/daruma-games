#!/usr/bin/env bash

# Check if sudo is installed
if command -v sudo &>/dev/null; then
    SUDO="sudo"
else
    SUDO=""
fi

SOURCE="$1"
DEST="$2"

IFS=":" read -ra SOURCE_ARR <<<"$SOURCE"
IFS=":" read -ra DEST_ARR <<<"$DEST"

if [[ ${#SOURCE_ARR[@]} -eq 2 && ${#DEST_ARR[@]} -eq 1 ]]; then
    VOL="${SOURCE_ARR[0]}"
    VOL_PATH="${SOURCE_ARR[1]}"
    HOST_PATH="${DEST_ARR[0]}"

    $SUDO docker container create --name docker_volume_cp -v "$VOL":/volume hello-world
    CMD="$SUDO docker cp docker_volume_cp:/volume/$VOL_PATH $HOST_PATH"
    #echo "$CMD"
    $CMD
    $SUDO docker rm docker_volume_cp

elif [[ ${#SOURCE_ARR[@]} -eq 1 && ${#DEST_ARR[@]} -eq 2 ]]; then
    VOL="${DEST_ARR[0]}"
    VOL_PATH="${DEST_ARR[1]}"
    HOST_PATH="${SOURCE_ARR[0]}"

    $SUDO docker container create --name docker_volume_cp -v "$VOL":/volume hello-world
    CMD="$SUDO docker cp $HOST_PATH docker_volume_cp:/volume/$VOL_PATH"
    #echo "$CMD"
    $CMD
    $SUDO docker rm docker_volume_cp
else
    echo "Usage:"
    echo "  This script allows copying data between Docker volumes and the host filesystem."
    echo ""
    echo "  To copy from a Docker volume to the host:"
    echo "    $0 VOLUME:VOL_PATH HOST_PATH"
    echo "    VOLUME     - Name of the Docker volume."
    echo "    VOL_PATH   - Path inside the Docker volume to copy from."
    echo "    HOST_PATH  - Destination path on the host filesystem."
    echo ""
    echo "  To copy from the host to a Docker volume:"
    echo "    $0 HOST_PATH VOLUME:VOL_PATH"
    echo "    HOST_PATH  - Source path on the host filesystem."
    echo "    VOLUME     - Name of the Docker volume."
    echo "    VOL_PATH   - Destination path inside the Docker volume."
    echo ""
    echo "Examples:"
    echo "  Copy from volume 'myvol' path '/data' to host path '/tmp/data':"
    echo "    $0 myvol:/data /tmp/data"
    echo ""
    echo "  Copy from host path '/tmp/data' to volume 'myvol' path '/data':"
    echo "    $0 /tmp/data myvol:/data"
fi
