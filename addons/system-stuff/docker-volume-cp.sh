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
    echo " volume --> host: $0 VOLUME:VOL_PATH HOST_PATH"
    echo " host --> volume: $0 HOST_PATH VOLUME:VOL_PATH"
fi
