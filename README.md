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

The Drive page can embed a live USB camera stream. Two backends are supported:

1. **WebRTC (recommended)** via the [`lowlatency-cam-streamer`](https://github.com/oe7set/lowlatency-cam-streamer) sidecar — H.264, hardware-encoded on the Pi, sub-200 ms latency, holds up over flaky WiFi.
2. **MJPEG (legacy fallback)** via [`mjpg-streamer`](https://github.com/jacksonliam/mjpg-streamer) — simple but bandwidth-heavy and brittle on bad links.

When both endpoints are configured the WebRTC path takes priority. When neither is configured the camera card stays hidden and the rest of the page is unaffected.

# Low-latency WebRTC camera (recommended)

The [`lowlatency-cam-streamer`](https://github.com/oe7set/lowlatency-cam-streamer) container captures a UVC USB camera, hardware-encodes H.264 (Pi `v4l2h264enc` / Intel VAAPI / x264 fallback), and exposes a standard WHEP endpoint that the Drive page consumes through a `<video>` element.

## 1. Add the streamer to your Compose stack

Add the following service alongside the `app` service you set up under [OpenMowerOS v2](#openmoweros-v2):

```yaml
  camera_streamer:
    image: ghcr.io/oe7set/lowlatency-cam-streamer:1
    container_name: camera_streamer
    restart: unless-stopped
    network_mode: host          # WebRTC ICE candidates need the host's IPs
    privileged: true            # /dev/video* access
    volumes:
      - /dev:/dev
    environment:
      LATENCY_PROFILE: balanced  # low | balanced | robust
      CAMERA_DEVICE: /dev/video0
      CAMERA_WIDTH: 1920
      CAMERA_HEIGHT: 1080
      CAMERA_FRAMERATE: 30
```

`LATENCY_PROFILE` picks defaults for keyframe interval, FEC, jitter buffer hint, and bitrate floor/cap. Pick `low` for tightest teleop, `robust` for bad WiFi. Every individual knob can be overridden via its own environment variable — see the [streamer README](https://github.com/oe7set/lowlatency-cam-streamer#latency-profiles).

## 2. (Optional) Tell the app where the WHEP endpoint lives

By default the app derives the WHEP URL from the request host:

```
http://<request-host>:8889/cam/whep
```

That works out of the box when the streamer runs colocated with the app on its standard port. Set `MOWER_WHEP_URL` explicitly only when the streamer is on a different host, port, or stream name:

```yaml
  app:
    image: ghcr.io/xtech/openmower-app:edge
    container_name: app
    ports:
      - 3000:3000
    environment:
      - MOWER_WHEP_URL=http://<mower-ip>:8889/cam/whep
    restart: unless-stopped
```

| Variable           | Default                                  | Description                                              |
|--------------------|------------------------------------------|----------------------------------------------------------|
| `MOWER_WHEP_URL`   | `http://<request-host>:8889/cam/whep`    | WHEP endpoint of the streamer. Empty string disables it. |

> [!NOTE]
> The Drive page shows live stats next to the camera card (resolution, framerate, bitrate, RTT) so you can confirm the connection at a glance.

# MJPEG camera (legacy fallback)

Use the MJPEG path if you can't run the WebRTC streamer (e.g. very old browsers, or a camera attached to a separate MJPEG box). It only kicks in when `MOWER_WHEP_URL` is empty *and* `MOWER_CAMERA_URL` is set.

## 1. Stream the camera with `mjpg-streamer`

Plug a UVC-compatible USB camera into the Pi. The kernel exposes it as `/dev/video0` (run `ls /dev/video*` to confirm; multi-camera or built-in CSI devices may bump the number).

Add a second service to the same Docker Compose stack you edited under [OpenMowerOS v2](#openmoweros-v2). The example below uses [`davidhamm/mjpg-streamer`](https://hub.docker.com/r/davidhamm/mjpg-streamer) — adjust the image, resolution, framerate, or port to taste:

```yaml
  mjpg-streamer:
    image: davidhamm/mjpg-streamer
    container_name: mjpg-streamer
    restart: unless-stopped
    devices:
      - /dev/video0:/dev/video0
    ports:
      - 8081:8080
    environment:
      - RESOLUTION=1280x720
      - ENV_RESOLUTION=1280x720
      - ENV_FPS=30
      - ENV_CAMERA=/dev/video0
```

Things to adjust:

- **Device path** — change `/dev/video0` (in both `devices:` and `ENV_CAMERA`) if your camera enumerates elsewhere.
- **Resolution / framerate** — `1280x720 @ 30 fps` works well on a CM4. Higher resolutions cost CPU and may stutter; drop the framerate before the resolution. The `RESOLUTION` and `ENV_RESOLUTION` variables both have to be set — the image uses `RESOLUTION` for the input plugin and `ENV_RESOLUTION` for the output plugin.
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
