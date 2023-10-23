# Systemd stuff

## Docker compose as a systemd unit

Create file `/etc/systemd/system/docker-compose@.service`. SystemD calling binaries using an absolute path.
In my case when installing the preferred way for docker the prefix is `/usr/bin`, you should use paths specific for your environment.

```ini
[Unit]
Description=%i service with docker compose
PartOf=docker.service
After=docker.service

[Service]
Type=simple
WorkingDirectory=/etc/docker/compose/%i
ExecStartPre=/usr/bin/docker compose pull --ignore-pull-failures
ExecStart=/usr/bin/docker compose up --remove-orphans
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
```

Place your `docker-compose.yml` into `/etc/docker/compose/darumagames` and call

### Enable and start the service

````sh
sudo systemctl enable docker-compose@darumagames.service
sudo systemctl start docker-compose@darumagames.service

### Checking the service

```sh
sudo systemctl status docker-compose@darumagames.service
````

## Using Journalctl

```sh
sudo journalctl -u  docker-compose@darumagames.*
```

### To follow the logs

```sh
sudo journalctl -u  docker-compose@darumagames.* -f
```

## Useful bash aliases

```sh
# Docker Compose aliases
alias dglogs='sudo journalctl -u docker-compose@darumagames.*'
alias dgstatus='sudo systemctl status docker-compose@darumagames.*'
alias dgstart='sudo systemctl start docker-compose@darumagames.service'
alias dgstop='sudo systemctl stop docker-compose@darumagames.service'
alias dgrestart='sudo systemctl restart docker-compose@darumagames.service'
```
