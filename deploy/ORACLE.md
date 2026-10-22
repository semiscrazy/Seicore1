# Hosting Seicore for free (Oracle Cloud + DuckDNS)

It takes about 30–45 minutes the first time. Everything here is free:

- **Oracle Cloud "Always Free"**: a small server that stays free.
- **DuckDNS**: a free web address like `semih.duckdns.org`.
- **Caddy** (installed by the script): free HTTPS certificate, which phone notifications need.

## 1. Create an Oracle Cloud account
1. Sign up at https://signup.cloud.oracle.com.
2. Oracle asks for a credit card **to verify your identity only**. Always Free resources are not charged.
3. Pick a **home region** close to you. You can't change it later, and the free server must be in this region.

> **Recommended:** after the account is active, go to *Billing → Upgrade and Manage Payment* and upgrade to **Pay As You Go**. Always Free resources stay free, and Oracle no longer **deletes idle free servers**. A small personal app like this one counts as "idle". To keep paying nothing, only create resources marked *Always Free-eligible*.

## 2. Create the server
1. Menu → **Compute → Instances → Create instance**.
2. **Image:** *Change image* → **Canonical Ubuntu 24.04**.
3. **Shape:** *Change shape*, then pick either one (both are Always Free):
   - **Ampere** → `VM.Standard.A1.Flex` with 1 OCPU and 6 GB memory (best), or
   - **Specialty and previous generation** → `VM.Standard.E2.1.Micro` (use this if Ampere says "out of capacity").
4. **Networking:** keep the defaults and make sure **Assign a public IPv4 address** is on.
5. **SSH keys:** choose **Generate a key pair for me** and click **Save private key**. Keep that file safe.
6. Click **Create**. When it's running, copy the **Public IP address**.

## 3. Open the web ports in Oracle's firewall
1. On the instance page, click the **subnet** link, then the **Default Security List**.
2. **Add Ingress Rules** twice:
   - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination port `80`
   - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination port `443`

## 4. Get a free web address
1. Go to https://www.duckdns.org and sign in (with Google, GitHub, etc.).
2. Choose a subdomain, e.g. `semih`, and click **add domain**.
3. Put the server's **public IP** in the *current ip* box and click **update ip**.

## 5. Install Seicore
Connect to the server. On Mac/Linux, open Terminal (on Windows, PowerShell works too):

```bash
chmod 600 ~/Downloads/ssh-key-*.key          # the file you saved in step 2
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_PUBLIC_IP
```

Then run this on the server, using your own address and email:

```bash
curl -fsSL https://raw.githubusercontent.com/semiscrazy/Seicore1/claude/productivity-app-routine-mgmt-oacg1s/deploy/setup.sh -o setup.sh
sudo bash setup.sh semih.duckdns.org you@example.com
```

It runs for 5–10 minutes. When it prints **Done!**, open `https://semih.duckdns.org` and create your account. On your phone:
- **iPhone:** open the address in Safari, tap *Share → Add to Home Screen*, open Seicore from the Home Screen, then *Settings → Turn on* notifications.
- **Android:** open it in Chrome, tap *Install app* (or *Add to Home screen*), then *Settings → Turn on* notifications.

## Updating later
When new features are pushed to GitHub, connect to the server again and re-run the same command:

```bash
sudo bash setup.sh semih.duckdns.org you@example.com
```

## Good to know
- **Backups:** the database is copied every night to `/var/lib/seicore/backups` and kept for 14 days.
- **Logs:** `journalctl -u seicore -n 50`
- **Restart:** `sudo systemctl restart seicore`
