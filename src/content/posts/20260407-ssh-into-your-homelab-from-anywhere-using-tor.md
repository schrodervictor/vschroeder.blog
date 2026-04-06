---
title: SSH into your homelab from anywhere using Tor
description: >
  How to set up a Tor hidden service to SSH into a remote machine without
  opening ports, configuring NAT, or exposing your server to the internet.
pubDate: 2026-04-07
author: Victor Schroeder
tags:
  - tor
  - ssh
  - homelab
  - linux
  - security
---

Most homelab setups sit behind a router with no public IP, or behind CGNAT,
or on a network you don't control. The classic solution is port forwarding,
dynamic DNS, a VPN, or a reverse tunnel. Each comes with its own headaches:
firewall rules, DNS propagation, keeping a tunnel alive, trusting a third-party
relay.

There's a simpler option that solves all of these at once: **Tor hidden
services** (also known as "onion services"). You run the Tor daemon on both
ends, and it handles the routing. No ports to open, no NAT to configure, no
public IP needed. Your server gets a `.onion` address that only you can reach
and as a bonus, the entire connection is encrypted, anonymized and routed
through the Tor network.

The focus of this guide is **not** the privacy features of Tor, though you get
those for free. The focus is practical: how to reliably SSH into a machine from
anywhere in the world, with zero network configuration on the server side.

Both machines in this guide run Debian. The steps should be similar for Ubuntu
and other Debian-based distributions. With minimal changes, you can also run
this on macOS.

## Part 1: Server setup

The server is the machine you want to SSH into, be it your homelab, a NAS
server, a Raspberry Pi or a box under your desk at the office.

### 1.1. Add the Tor apt repository

The Tor project maintains its own Debian repository with up-to-date packages.
Don't use the version in Debian's default repos as it is often outdated.

First, get the signing key:

```shell
$ wget https://deb.torproject.org/torproject.org/A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc
```

You should check if the key has the correct fingerprint. It should match the
filename above (ending with `886D DD89`). You can do it like this:

```shell
$ gpg A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc
gpg: WARNING: no command supplied.  Trying to guess what you mean ...
pub   rsa2048 2009-09-04 [SC] [expires: 2028-08-29]
      A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89
uid           deb.torproject.org archive signing key
sub   rsa2048 2009-09-04 [S] [expires: 2027-11-01]
```

If you are confident with the output, dearmor the key and put it in the right
place for apt:

```shell
$ sudo gpg --dearmor \
    --output /usr/share/keyrings/deb.torproject.org-keyring.gpg \
    A3C4F0F979CAA22CDBA8F512EE8CBC9E886DDD89.asc
```

Then add the repository. I'm using Debian Trixie, so we can use the new sources
syntax. Change "trixie" to your distro's codename, that you can find using
`lsb_release -cs`. Add the following to `/etc/apt/sources.list.d/tor.sources`:

```apt-source
Types: deb deb-src
URIs: https://deb.torproject.org/torproject.org/
Suites: trixie
Components: main
Signed-By: /usr/share/keyrings/deb.torproject.org-keyring.gpg
```

If you are still stuck with the old syntax, create a `tor.list` instead:

```apt-list
deb [signed-by=/usr/share/keyrings/deb.torproject.org-keyring.gpg] https://deb.torproject.org/torproject.org trixie main
```

### 1.2. Install Tor

I usually advise using `--no-install-recommends` for a minimal footprint and
cleaner system. You can always install more stuff later when you really need:

```shell
$ sudo apt update
$ sudo apt install tor --no-install-recommends
```

### 1.3. Create the hidden service directory

Tor needs a directory to store the hidden service keys and hostname. Create it
under `/var/lib/tor/` and give ownership to the `debian-tor` system user. The
name `ssh_proxy` can be anything you want. That's your hidden service internal
identifier:

```shell
$ sudo mkdir -p /var/lib/tor/ssh_proxy
$ sudo chown -R debian-tor: /var/lib/tor/ssh_proxy
$ sudo chmod 700 /var/lib/tor/ssh_proxy
```

### 1.4. Configure the hidden service

Edit `/etc/tor/torrc` and add/uncomment the following:

```
SocksPort 9050
DataDirectory /var/lib/tor
HiddenServiceDir /var/lib/tor/ssh_proxy/
HiddenServicePort 22 127.0.0.1:22
```

This tells Tor to expose port 22 (SSH) on the local machine as a hidden
service. The `HiddenServicePort` directive maps the onion service's port 22 to
`127.0.0.1:22`. Exposed on localhost only, no external exposure.

### 1.5. Start Tor and get the onion address

Restart the Tor service to generate the hidden service keys:

```shell
$ sudo systemctl restart tor
```

Tor creates several files inside `/var/lib/tor/ssh_proxy/`:

- `hostname`: your `.onion` address
- `hs_ed25519_public_key`: the service's public key
- `hs_ed25519_secret_key`: the service's secret key

Grab the onion address:

```shell
$ sudo cat /var/lib/tor/ssh_proxy/hostname
```

Save this value, you'll need it for the client configuration next.

At this point, the hidden service is running and **anyone who knows the onion
address can reach it**. Since we want to restrict access to authorized clients
only, we'll set up client authentication next.

### 1.6. Generate a client key pair

Tor v3 onion services use x25519 key pairs for client authentication. The
[python-snippits](https://github.com/pastly/python-snippits) repository has a
handy script for generating them:

```shell
$ wget https://raw.githubusercontent.com/pastly/python-snippits/master/src/tor/x25519-gen.py

# You may need to install `pynacl` to run it
$ python3 x25519-gen.py
public:  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
private: BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB
```

This outputs a public key and a private key. You'll need both. The public key
goes on the server, the private key goes on the client.

### 1.7. Authorize the client

Create a file in the `authorized_clients` directory with the public key. Each
client needs a file there with the correct public key. For example
`/var/lib/tor/ssh_proxy/authorized_clients/client.auth` with the
following content:

```txt
descriptor:x25519:$PUBLIC_KEY
```

Replace `$PUBLIC_KEY` with the actual public key from the previous step. The
file name (`client.auth`) can be anything, use something descriptive like
`laptop.auth` or `work.auth` if you have multiple clients.

Don't forget to adjust permissions and ownership:

```shell
$ sudo chown debian-tor: /var/lib/tor/ssh_proxy/authorized_clients/client.auth
$ sudo chmod 640 /var/lib/tor/ssh_proxy/authorized_clients/client.auth
```

### 1.8. Restart Tor

```shell
$ sudo systemctl restart tor
```

From this point on, only clients holding the matching private key can connect
to the hidden service. Anyone else attempting to reach the onion address will
get nothing.

You now have two pieces of information to take to the client:
- The `.onion` address from `hostname`
- The private key from step 1.6

## Part 2: Client setup

The client is the machine you SSH from, such as your laptop, your phone,
a workstation at a coffee shop, etc. This side is simpler as you won't be
running any hidden service, only the authentication details are required.

### 2.1. Add the Tor apt repository

Follow the same steps 1.1 and 1.2 described above for the installation on
the server to get Tor installed on the client side.

### 2.2. Configure the Tor client

Edit `/etc/tor/torrc` to add or uncomment the following:

```
SocksPort 9050
ClientOnionAuthDir /var/lib/tor/onion_auth
```

Create the auth directory, which will store the private keys to authenticate
against different onion services:

```shell
$ sudo mkdir -p /var/lib/tor/onion_auth
$ sudo chown -R debian-tor: /var/lib/tor/onion_auth
$ sudo chmod 700 /var/lib/tor/onion_auth
```

### 2.3. Add the private key

Create an `.auth_private` file with the private key from step 1.6. **The filename
here matters!** You'll use this name to identify the server you want to connect to.
Use a descriptive nickname: `homelab.auth_private`, `raspberry.auth_private`,
`office.auth_private` or something else that makes sense for you. If you connect
to multiple onion services, you'll have one file per server in this directory.

In this example, let's create `/var/lib/tor/onion_auth/homelab.auth_private` with
the following content:

```txt
$ONION_ADDRESS:descriptor:x25519:$PRIVATE_KEY
```

Replace `$ONION_ADDRESS` with the hostname you collected on step 1.5 above and
the `$PRIVATE_KEY` from step 1.6. **ATTENTION**: don't include the `.onion`
part of the hostname, just the first part with the random address.

Finally, fix the ownership and permissions:

```shell
$ sudo chown debian-tor: /var/lib/tor/onion_auth/homelab.auth_private
$ sudo chmod 640 /var/lib/tor/onion_auth/homelab.auth_private
```

### 2.4. Restart Tor

```shell
$ sudo systemctl restart tor
```

### 2.5. Configure SSH

At this point, you should already be able to connect to the remote server
using `nc -x localhost:9050 $ONION_ADDRESS.onion 22`, but that would give
you a raw TCP connection, which is not what we want.

In order to establish a valid SSH session and do the whole thing more easily,
let's add an entry to `~/.ssh/config`:

```
Host homelab
    Hostname $ONION_ADDRESS.onion
    User $USERNAME
    Port 22
    CheckHostIP no
    ProxyCommand /usr/bin/nc -x localhost:9050 %h %p
```

Replace `$ONION_ADDRESS` with your full `.onion` address and `$USERNAME` with
your SSH user on the server. The `homelab` here matches the file we created
`homelab.auth_private`, you should change it to whatever you used on that
step.

`CheckHostIP no` is needed because `.onion` addresses don't resolve to stable
IPs, so the check would fail every time.

If you are authenticating with password, you may want to add this as well:

```
    PreferredAuthentications password
    PubkeyAuthentication no
```

The `ProxyCommand` routes the SSH connection through the local Tor SOCKS proxy
on port 9050, which is the port Tor is listening to.

The `-x` flag tells netcat to use a SOCKS proxy. This requires the
`netcat-openbsd` package. Debian systems sometimes ship with
`netcat-traditional` instead, which doesn't support `-x`. Check which one you
have:

```shell
$ readlink -f "$(which nc)"
```

If it points to `nc.traditional`, install the OpenBSD variant:

```shell
$ sudo apt install netcat-openbsd
```

### 2.6. Connect

With the SSH configuration in place, connecting to the server is as easy as
running the following:

```shell
$ ssh homelab
```

That's it. The first connection will take a few seconds while Tor establishes
the circuit, but after that you have a regular SSH session, just routed
through the Tor network.

## Why this works

Tor onion services solve several problems at once:

- **No port forwarding**: the server makes outbound connections to the Tor
  network, not inbound. Your router's firewall doesn't matter.
- **No public IP needed**: works behind CGNAT, double NAT, corporate
  firewalls, hotel Wi-Fi, anything.
- **No dynamic DNS**: the `.onion` address is derived from the service's
  cryptographic key, not from an IP. It never changes.
- **End-to-end encryption**: the connection is encrypted between client and
  server, independent of SSH's own encryption. Two layers.
- **Client authentication**: with x25519 keys, only authorized clients can
  even reach the service. Unauthorized attempts get no response at all, the
  server is invisible.

The trade-off is latency. Tor routes traffic through multiple relays, so expect
200–800ms round-trip times. For interactive SSH sessions, this is noticeable
but workable. For `scp` or `rsync`, it's slow. You'll want a different
solution for bulk file transfers.

But for command-line access to a homelab from a random coffee shop? It's hard
to beat this one.
