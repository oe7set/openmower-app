# Overview

This is a completely new app for your OpenMower robotic lawnmower.

At this time, "only" the map editor and some debug information are enabled.

# Installation

> [!WARNING]
> In this early stage of the app, we only have an `edge` tag, which always points to the latest commit on the `main` branch. Later, when we switch to proper releases, there will also be a `latest` tag, pointing to the latest release. Also the port (currently `:3000`) might be changed later. You should still follow the steps below, just be prepared to adjust the config later.

## OpenMowerOS v2

1. Go to `http://<mower-ip>:5001/compose/openmower` in your browser.
2. Switch to edit mode.
3. In the `compose.yaml` editor, add the following lines above the `# Dockge-specific extras shown in the UI` line:

   ```yaml
     app:
       image: ghcr.io/xtech/openmower-app:edge
       container_name: app
       ports:
         - 3000:3000
       restart: unless-stopped
   ```

   Double-check the indentation, `app` should be indented 2 spaces, just like the other containers.

4. Add the new URL:
   ```yaml
   x-dockge:
     urls:
       - http://${HOSTNAME}:8080
       - http://${HOSTNAME}:3000
   ```
5. Click the `Deploy` button.

You can now access the app at `http://<mower-ip>:3000` in your browser.

## OpenMowerOS legacy

For the legacy OpenMowerOS image, you need to create a `systemd` service. Create a file at `/etc/systemd/system/openmower-app.service` with the following content:

```
[Unit]
Description=Podman container - openmower-app.service
Documentation=man:podman-generate-systemd(1)
Wants=network.target
After=network-online.target NetworkManager.service
StartLimitInterval=120
StartLimitBurst=10

[Service]
Environment=PODMAN_SYSTEMD_UNIT=%n
Type=forking
Restart=always
RestartSec=15s
TimeoutStartSec=1h
TimeoutStopSec=120s

ExecStartPre=/bin/rm -f %t/container-openmower-app.pid %t/container-openmower-app.ctr-id

ExecStart=/usr/bin/podman run --conmon-pidfile %t/container-openmower-app.pid --cidfile %t/container-openmower-app.ctr-id --cgroups=no-conmon \
  --replace --detach --tty \
  --name openmower-app \
  --publish 3000:3000/tcp \
  --label io.containers.autoupdate=image \
  ghcr.io/xtech/openmower-app:edge

ExecStop=/usr/bin/podman stop --ignore --cidfile %t/container-openmower-app.ctr-id -t 10
ExecStopPost=/usr/bin/podman rm --ignore --force --cidfile %t/container-openmower-app.ctr-id
PIDFile=%t/container-openmower-app.pid

[Install]
WantedBy=multi-user.target default.target
```

Then enable the service and start it:
```bash
sudo systemctl enable --now openmower-app.service
```

You can now access the app at `http://<mower-ip>:3000` in your browser.

# Drive page camera (optional)

The Drive page can embed a live MJPEG stream from a USB webcam plugged into the Raspberry Pi (or any other reachable MJPEG endpoint). The app itself does not produce the stream — it just displays whatever URL you configure. When the URL is unset, the camera card stays hidden and the rest of the page is unaffected.

## 1. Stream the camera with `mjpg-streamer`

Plug a UVC-compatible USB camera into the Pi. The kernel exposes it as `/dev/video0` (run `ls /dev/video*` to confirm; multi-camera or built-in CSI devices may bump the number).

Add a second service to the same Docker Compose stack you edited under [OpenMowerOS v2](#openmowerosv2). The example below uses [`ghcr.io/jacksonliam/mjpg-streamer:master`](https://github.com/jacksonliam/mjpg-streamer) — adjust the image, resolution, framerate, or port to taste:

```yaml
  mjpg-streamer:
    image: ghcr.io/jacksonliam/mjpg-streamer:master
    container_name: mjpg-streamer
    restart: unless-stopped
    devices:
      - /dev/video0:/dev/video0
    ports:
      - 8081:8080
    command: >
      -i "input_uvc.so -d /dev/video0 -r 640x480 -f 15 -q 75"
      -o "output_http.so -p 8080 -w /usr/local/share/mjpg-streamer/www"
```

Things to adjust:

- **Device path** — change `/dev/video0` on both sides if your camera enumerates elsewhere.
- **Resolution / framerate** — `-r 640x480 -f 15` is a safe starting point on a CM4. Higher resolutions cost CPU and may stutter; drop the framerate before the resolution.
- **Quality** — `-q 75` (JPEG quality 0–100). Lower it if WLAN is the bottleneck.
- **Host port** — `8081:8080` exposes the streamer at `http://<mower-ip>:8081`. Change the *host* side (left of the colon) if `8081` is already taken; leave the container side at `8080`.

> [!NOTE]
> The container needs access to the kernel video device. The `devices:` mapping above is enough for most setups. On hardened hosts you may need to also set `group_add: ["video"]` or run the container `privileged: true`. Confirm the stream works by opening `http://<mower-ip>:8081/?action=stream` directly in your browser before wiring it into the app.

## 2. Tell the app where the stream lives

Add a `MOWER_CAMERA_URL` environment variable to the `app` service so the Drive page knows the endpoint:

```yaml
  app:
    image: ghcr.io/xtech/openmower-app:edge
    container_name: app
    ports:
      - 3000:3000
    environment:
      - MOWER_CAMERA_URL=http://<mower-ip>:8081/?action=stream
    restart: unless-stopped
```

Replace `<mower-ip>` with the address the *browser* uses to reach the mower (e.g. `192.168.1.42` or the mower's mDNS name). The URL is rendered into an `<img src="...">` on the client, so it must be reachable from the device viewing the page, not just from inside the container.

> [!WARNING]
> Browsers will refuse mixed content if the app is later served over HTTPS but the camera stays on plain HTTP. If you put the app behind TLS, terminate TLS in front of `mjpg-streamer` too (e.g. via a reverse proxy on the Pi) and use `https://...` in `MOWER_CAMERA_URL`.

After saving the compose file, click **Deploy** in Dockge. The Drive page will now show a "Camera" card above the Mode switcher with live feed, fullscreen toggle, and automatic reconnect every 2 seconds if the stream drops.
