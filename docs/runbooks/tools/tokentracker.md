# TokenTracker CLI Runbook

Date: 2026-06-08
Status: Public extended install and service runbook

## Purpose

Use this runbook to install and run the maintained TokenTracker CLI package as
a foreground command or background service.

The public npm package verified for this handoff is:

```text
@ipv9/tokentracker-cli@0.39.6
```

The package currently provides these binary aliases:

```text
tokentracker
tracker
tokentracker-cli
tokentracker-tracker
```

The package name `@ipv9/tokentracker` was not available in the npm registry at
the time this runbook was written. Use `@ipv9/tokentracker-cli` unless the
manifest is updated after a future package rename.

## Safety

Do not paste or publish API keys, bearer tokens, device tokens, local auth
headers, cloud sync tokens, or raw AI transcript content.

For shared machines, prefer local dashboard mode first. Configure cloud/device
sync only when the operator understands where data is sent.

## Requirements

- Node.js `>=20`
- `npm` and `npx` available in the service environment
- A writable home directory for `~/.tokentracker/`

Verify the package:

```bash
npm view @ipv9/tokentracker-cli version bin engines --json
npx --yes @ipv9/tokentracker-cli --help
```

## Foreground Use

Open the dashboard:

```bash
npx --yes @ipv9/tokentracker-cli
```

Serve the dashboard without opening a browser:

```bash
npx --yes @ipv9/tokentracker-cli serve --sync --no-open --port 7680
```

Run one local sync:

```bash
npx --yes @ipv9/tokentracker-cli sync --auto
```

Check state without printing secrets:

```bash
npx --yes @ipv9/tokentracker-cli status
npx --yes @ipv9/tokentracker-cli doctor --json
```

## Service Model

Use two separate background jobs when possible:

- dashboard service: long-running `serve --sync --no-open --port 7680`
- local sync service: periodic `sync --auto`

The local sync command should not run with a cloud-capable device token unless
that is intentional. The maintained macOS installer skips automatic local sync
when `TOKENTRACKER_DEVICE_TOKEN` or `~/.tokentracker/tracker/config.json`
`deviceToken` is configured.

## macOS LaunchAgent

If installing from the TokenTracker project checkout, use the packaged script:

```bash
bash scripts/install-local-service.sh
```

For an npm-only install, create a LaunchAgent manually:

```bash
mkdir -p ~/.tokentracker/tracker/logs ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.pitimon.tokentracker.dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/env</string>
    <string>npx</string>
    <string>--yes</string>
    <string>@ipv9/tokentracker-cli</string>
    <string>serve</string>
    <string>--sync</string>
    <string>--no-open</string>
    <string>--port</string>
    <string>7680</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>__HOME__/.tokentracker/tracker/logs/dashboard.out.log</string>
  <key>StandardErrorPath</key>
  <string>__HOME__/.tokentracker/tracker/logs/dashboard.err.log</string>
</dict>
</plist>
PLIST

sed -i.bak "s#__HOME__#$HOME#g" ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist
rm -f ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist.bak

launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist
launchctl kickstart -k "gui/$(id -u)/com.pitimon.tokentracker.dashboard"
```

Verify:

```bash
launchctl print "gui/$(id -u)/com.pitimon.tokentracker.dashboard"
curl -fsS http://127.0.0.1:7680/ >/dev/null
tail -n 50 ~/.tokentracker/tracker/logs/dashboard.err.log
```

Uninstall:

```bash
launchctl bootout "gui/$(id -u)" ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.pitimon.tokentracker.dashboard.plist
```

## Linux systemd User Service

Use a user service when the dashboard is for one account:

```bash
mkdir -p ~/.config/systemd/user ~/.tokentracker/tracker/logs

cat > ~/.config/systemd/user/tokentracker-dashboard.service <<'UNIT'
[Unit]
Description=TokenTracker dashboard
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/env npx --yes @ipv9/tokentracker-cli serve --sync --no-open --port 7680
Restart=always
RestartSec=5
WorkingDirectory=%h

[Install]
WantedBy=default.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now tokentracker-dashboard.service
```

Enable linger if the service must survive after logout:

```bash
loginctl enable-linger "$USER"
```

Periodic local sync:

```bash
cat > ~/.config/systemd/user/tokentracker-sync.service <<'UNIT'
[Unit]
Description=TokenTracker local sync

[Service]
Type=oneshot
ExecStart=/usr/bin/env npx --yes @ipv9/tokentracker-cli sync --auto
UNIT

cat > ~/.config/systemd/user/tokentracker-sync.timer <<'UNIT'
[Unit]
Description=Run TokenTracker local sync every 5 minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=5min
Unit=tokentracker-sync.service

[Install]
WantedBy=timers.target
UNIT

systemctl --user daemon-reload
systemctl --user enable --now tokentracker-sync.timer
```

Verify:

```bash
systemctl --user status tokentracker-dashboard.service
systemctl --user list-timers tokentracker-sync.timer
journalctl --user -u tokentracker-dashboard.service -n 100 --no-pager
curl -fsS http://127.0.0.1:7680/ >/dev/null
```

Uninstall:

```bash
systemctl --user disable --now tokentracker-dashboard.service tokentracker-sync.timer 2>/dev/null || true
rm -f ~/.config/systemd/user/tokentracker-dashboard.service
rm -f ~/.config/systemd/user/tokentracker-sync.service
rm -f ~/.config/systemd/user/tokentracker-sync.timer
systemctl --user daemon-reload
```

## Windows PowerShell Scheduled Task

Use PowerShell as the current user. This keeps the dashboard alive after login.

Find `npx.cmd`:

```powershell
$Npx = (Get-Command npx.cmd).Source
$Npx
```

Create the dashboard task:

```powershell
$Action = New-ScheduledTaskAction `
  -Execute $Npx `
  -Argument '--yes @ipv9/tokentracker-cli serve --sync --no-open --port 7680'

$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet `
  -RestartCount 3 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -AllowStartIfOnBatteries `
  -DisallowStartIfOnBatteries:$false

Register-ScheduledTask `
  -TaskName 'TokenTracker Dashboard' `
  -Action $Action `
  -Trigger $Trigger `
  -Settings $Settings `
  -Description 'TokenTracker local dashboard service' `
  -Force

Start-ScheduledTask -TaskName 'TokenTracker Dashboard'
```

Create a periodic sync task:

```powershell
$SyncAction = New-ScheduledTaskAction `
  -Execute $Npx `
  -Argument '--yes @ipv9/tokentracker-cli sync --auto'

$SyncTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 5)

Register-ScheduledTask `
  -TaskName 'TokenTracker Local Sync' `
  -Action $SyncAction `
  -Trigger $SyncTrigger `
  -Description 'TokenTracker periodic local sync' `
  -Force
```

Verify:

```powershell
Get-ScheduledTask -TaskName 'TokenTracker Dashboard','TokenTracker Local Sync'
Get-ScheduledTaskInfo -TaskName 'TokenTracker Dashboard'
Invoke-WebRequest http://127.0.0.1:7680/ -UseBasicParsing
npx --yes @ipv9/tokentracker-cli doctor --json
```

Uninstall:

```powershell
Unregister-ScheduledTask -TaskName 'TokenTracker Dashboard' -Confirm:$false
Unregister-ScheduledTask -TaskName 'TokenTracker Local Sync' -Confirm:$false
```

## WSL

Choose one WSL mode.

### WSL With systemd

If `systemctl` works inside WSL, use the Linux systemd user-service section.

Verify systemd:

```bash
systemctl --user status
```

### WSL Without systemd

Use Windows Task Scheduler to start the Linux command through `wsl.exe` at
login:

```powershell
$Wsl = "$env:WINDIR\System32\wsl.exe"
$Distro = 'Ubuntu'
$Command = "bash -lc 'npx --yes @ipv9/tokentracker-cli serve --sync --no-open --port 7680'"

$Action = New-ScheduledTaskAction `
  -Execute $Wsl `
  -Argument "-d $Distro -- $Command"

$Trigger = New-ScheduledTaskTrigger -AtLogOn

Register-ScheduledTask `
  -TaskName 'TokenTracker Dashboard WSL' `
  -Action $Action `
  -Trigger $Trigger `
  -Description 'TokenTracker dashboard inside WSL' `
  -Force

Start-ScheduledTask -TaskName 'TokenTracker Dashboard WSL'
```

Verify from Windows:

```powershell
Invoke-WebRequest http://127.0.0.1:7680/ -UseBasicParsing
```

Uninstall:

```powershell
Unregister-ScheduledTask -TaskName 'TokenTracker Dashboard WSL' -Confirm:$false
```

## Update

For `npx` usage, each new invocation resolves the current package according to
npm cache behavior. To force refresh:

```bash
npm cache verify
npx --yes @ipv9/tokentracker-cli@latest --help
```

For pinned services, edit the service command to the target version:

```text
@ipv9/tokentracker-cli@0.39.6
```

Then restart the service.

## Verification Checklist

Run these after install, update, or service changes:

```bash
node --version
npm view @ipv9/tokentracker-cli version dist-tags.latest engines --json
npx --yes @ipv9/tokentracker-cli --help
npx --yes @ipv9/tokentracker-cli status
npx --yes @ipv9/tokentracker-cli doctor --json
curl -fsS http://127.0.0.1:7680/ >/dev/null
```

Expected:

- Node is `>=20`
- npm reports the intended `@ipv9/tokentracker-cli` version
- `--help` exits successfully
- dashboard responds on `127.0.0.1:7680`
- service manager shows the dashboard service running

## Troubleshooting

If the dashboard opens but token rows are empty, run:

```bash
npx --yes @ipv9/tokentracker-cli sync --auto
npx --yes @ipv9/tokentracker-cli doctor --json
```

If a service cannot find `npx`, use an absolute path from:

```bash
command -v npx
command -v node
```

On macOS with Homebrew Node, service commands may need `/opt/homebrew/bin/npx`
or `/usr/local/bin/npx` instead of `/usr/bin/env npx`.

On Windows, recreate the scheduled task after changing Node install paths.
