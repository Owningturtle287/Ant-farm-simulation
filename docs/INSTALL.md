# Install Little Colony on iPhone

The GitHub Actions workflow builds the actual native iPhone app. A browser preview and an iPhone simulator build are not substitutes for the device IPA.

1. Open this repository's Actions tab and the latest successful **Little Colony · iPhone** run for `main`.
2. Under Artifacts, download `LittleColony-0.1-unsigned-iphone-<commit>` and extract the ZIP.
3. Re-sign and install `LittleColony-unsigned.ipa` using your existing trusted iOS sideloading process. This build is deliberately unsigned; downloading it in Safari does not install it. Signing validity and renewal requirements depend on that process and account.
4. Open **Little Colony**, turn your phone sideways, and enter the clearing.

GitHub may require you to sign in to download Actions artifacts. These artifacts are retained for 30 days.

## Signed ad hoc builds

For a signed IPA, an Apple Developer account, distribution certificate, and ad hoc provisioning profile covering `com.owningturtle.antfarm` and the target phone are needed. Configure repository secrets through GitHub's own settings:

- `BUILD_CERTIFICATE_BASE64`: Base64-encoded distribution `.p12` certificate.
- `P12_PASSWORD`: its password.
- `BUILD_PROVISION_PROFILE_BASE64`: Base64-encoded ad hoc profile.

Then run the workflow manually on `main` and enable `signed_adhoc`. Download the `signed-iphone` artifact only after that job succeeds and install it through a supported ad hoc installation process. Never paste certificates or passwords into source files, issues, or logs.

This repository also opens directly in Xcode 16.4 or later. Choose the AntFarm scheme, select your signing team, and run on your registered phone. Minimum OS: iOS 17; landscape; iPhone only.

## Play

- Drag the world to explore; pinch to zoom.
- Tap an ant for its profile. Repeated taps cycle through overlapping ants.
- Food / Water: select a tool, then tap to place a source at that horizontal position on the surface.
- Trails: display pheromone signals.
- Nest: return the camera home.
- Colony: inspect the population and select an individual.
- Pause and 1× / 2× / 4×: control the pace.
- More: save, read the guide, or start a new colony after confirmation.

The colony autosaves every 20 seconds and when leaving the app. Simulation pauses in menus and while closed. There is no offline catch-up in v0.1.
