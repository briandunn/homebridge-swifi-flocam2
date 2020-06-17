<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

# Swann Floodlight

Control the floodlight on [Swann Floodlight Security Cameras](https://www.swann.com/us/swwhd-flocamw).

## Install

- Add the camera via the swann app
- Configure your router's DHCP to allocate a known IP to the camera

## Configuration

Add this to the `platforms` list:

```json
{
  "platform": "SwifiFlocam2",
  "devices": [
    {
      "name": "back yard",
      "host": "<Camera IP>",
      "port": 85
    }
  ]
}
```

## Troubleshooting

I only have one of these, so I don't know if they always use port 85 for the HTTP server. If you're getting errors in the homebridge log, you can spy on the app to find out what port it's using.

I used `rvictl` with wireshark on my mac. (These helpful instructions](https://github.com/AMoo-Miki/homebridge-tuya-lan/wiki/Common-Problems#want-to-help-debug-and-have-a-mac) should get you started.
Once you're spying on phone traffic, filter to the IP of your camera. Play around with the app controls and see what happens. If you learn something please open an issue on this repo.

## Video Feed

(Homebridge Camera FFmpeg)[https://www.npmjs.com/package/homebridge-camera-ffmpeg] works for the camera with the following config:

```json
{
  "cameras": [
    {
      "name": "back yard",
      "motion": true,
      "videoConfig": {
        "source": "-re -i rtsp://10.0.1.30:554/mpeg4",
        "audio": true
      }
    }
  ],
  "platform": "Camera-ffmpeg"
}
```

## TODO

[] Poll (or subscribe?) to update light state when activated elsewhere (app or motion sensor)
[] Discovery?
