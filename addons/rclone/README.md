# Rclone

Place your `docker-compose.yml` into `/etc/docker/compose/rclone` and call

## Enable and start the service

````sh
sudo systemctl enable docker-compose@rclone.service
sudo systemctl start docker-compose@rclone.service

### Checking the service

```sh
sudo systemctl status docker-compose@rclone.service
````

## Using Journalctl

```sh
sudo journalctl -u  docker-compose@rclone.*
```

### To follow the logs

```sh
sudo journalctl -u  docker-compose@rclone.* -f
```

## Creating a timer

Create file `/etc/systemd/system/docker-compose@rclone.timer`.

The timer will run every 3 hours.

```ini
[Unit]
Description=Docker Compose Timer for rclone
Requires=docker-compose@rclone.service

[Timer]
OnCalendar=*-*-* 0/3:00:00

[Install]
WantedBy=timers.target
```

### Enable and start the timer

```sh
sudo systemctl enable docker-compose@rclone.timer
sudo systemctl start docker-compose@rclone.timer
```

### Checking the timer

```sh
sudo systemctl status docker-compose@rclone.timer
```

## Useful bash aliases

```sh
# Docker Compose aliases
alias rclonelogs='sudo journalctl -u docker-compose@rclone.*'
alias rclonestatus='sudo systemctl status docker-compose@rclone.*'
alias rclonestart='sudo systemctl start docker-compose@rclone.service'
alias rclonestop='sudo systemctl stop docker-compose@rclone.service'
alias rclonerestart='sudo systemctl restart docker-compose@rclone.service'
alias rclonetimers='sudo systemctl list-timers --all docker-compose@rclone.*'
alias rclonetimerstart='sudo systemctl start docker-compose@rclone.timer'
alias rclonetimerstop='sudo systemctl stop docker-compose@rclone.timer'
alias rclonetimerrestart='sudo systemctl restart docker-compose@rclone.timer'
```
