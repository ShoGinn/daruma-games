# Neat logger

## Dozzle

Dozzle is a simple, lightweight application that provides you with a web based interface to monitor your Docker container logs live.

```yaml
version: "3"
services:
  dozzle:
    container_name: dozzle
    image: amir20/dozzle:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - 9999:8080
    environment:
      - DOZZLE_NO_ANALYTICS=True
```

```url
http://hostname:9999
```
