# GitHub Actions and iPhone delivery

## Repository audit

At the start of this milestone, `Owningturtle287/Ant-farm-simulation` was empty: no commits, project files, workflow files, or existing deployment configuration could be inspected. GitHub Actions being enabled for a repository does not itself define an iOS build workflow. This milestone adds that workflow without assuming signing credentials are already present.

## Build paths

The **iOS Foundation** workflow runs on pushes and pull requests, and can be requested manually from Actions. It uses a macOS runner and the runner's available Xcode, printing its version. Untrusted PR builds do not receive signing credentials.

Normal builds validate project fixtures, run native tests, build a simulator app, launch it, capture an actual screenshot, and compile an unsigned device app. The device build is packaged as `AntFarm-unsigned.ipa`, explicitly for re-signing. A successful unsigned build is not evidence of iPhone installation.

Workflow artifacts are downloaded from a run's Artifacts section by a GitHub user with repository read access. Artifact retention is 14 days; the source remains in Git. For durable public releases, a later release workflow can attach the signed IPA to a GitHub Release.

## Optional signed ad hoc IPA

Use Actions → iOS Foundation → Run workflow → enable **Build signed ad hoc IPA**. The signing job checks its prerequisites, imports a certificate into a temporary keychain, installs one provisioning profile, archives, exports, and uploads `AntFarm-signed-adhoc`. Missing prerequisites produce an explicit failure instead of uploading an unsigned file under a signed label.

Configure the following repository secrets through GitHub Settings → Secrets and variables → Actions. Do not paste them into source files, issues, or chat.

| Secret | Required content |
| --- | --- |
| `BUILD_CERTIFICATE_BASE64` | Base64-encoded Apple distribution `.p12` certificate including private key |
| `P12_PASSWORD` | Password for that `.p12` |
| `BUILD_PROVISION_PROFILE_BASE64` | Base64-encoded ad hoc `.mobileprovision` for this app and the target iPhone |

The Apple team, application identifier, and profile UUID are read from the supplied profile at runtime. The profile must use an explicit app identifier, contain registered device UDIDs, be unexpired, and correspond to the certificate. The workflow selects that profile for manual signing. Keychain password is generated per run and never printed. The signed job is available only through manual dispatch, not a pull-request event.

Ad hoc installation is limited to phones provisioned in that profile. Use Apple's supported registered-device installation route (for example Apple Configurator on a Mac). A GitHub download link is not an over-the-air install service. If the intended route is an external re-signing tool, use the unsigned artifact and that tool's documented setup. TestFlight is a separate optional distribution choice, not silently enabled here.

## Verification ledger

Record evidence in the milestone pull request:

| Check | Evidence |
| --- | --- |
| Specification / palette / fixture checks | Local validation log and CI validation job |
| Native compile and tests | macOS Actions run, not Linux inspection |
| Native app launch | Simulator launch log and screenshot artifact |
| Device compilation | Unsigned device artifact |
| Apple signing | Only a successful manually requested signed job |
| Installation on the user's phone | Must be observed on that registered physical device |
| iPhone touch comfort / battery / heat | Physical-device validation in later milestones |

The source and delivery instructions can be complete while signed installation remains blocked by unavailable Apple credentials or device access. Do not mark signing or hardware checks complete without evidence.

## References

- [Apple: ad hoc provisioning](https://developer.apple.com/help/account/provisioning-profiles/create-an-ad-hoc-provisioning-profile/)
- [Apple: distributing to registered devices](https://developer.apple.com/documentation/xcode/distributing-your-app-to-registered-devices)
- [GitHub: Apple signing on macOS runners](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications)
- [GitHub: downloading artifacts](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/download-workflow-artifacts)
