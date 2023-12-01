# Nucleus Server

[![Build Status](https://travis-ci.org/atlassian/nucleus.svg?branch=enable-travis)](https://travis-ci.org/atlassian/nucleus) [![npm](https://img.shields.io/npm/v/nucleus-server.svg)](https://www.npmjs.com/package/nucleus-server) ![status](https://img.shields.io/badge/Status-%20Ready%20for%20Awesome-red.svg)

A configurable and versatile update server for all your Electron apps

## Features

* Multiple applications
* Multiple channels for each application
* Companion publisher for [electron-forge](https://github.com/electron-userland/electron-forge) to greatly simplify release publishing
* Backed by a static file store so minimal server costs
* One command to run so insanely simple to set up
* [Staged Rollouts](docs/Staged%20Rollouts.md)
  * macOS
  * Windows
* [Latest Downloads](docs/Latest%20Releases.md) - Static URL's for downloading the latest version of your application
* Platform Support:
  * macOS
  * Windows
  * Linux - RedHat
  * Linux - Debian

## Electron Version Requirements

Please note that using Nucleus requires that you use Electron `>=2.0.0`.

## Setup

### Docker

You'll need to set up your own docker image using a Dockefile like below.

```docker
FROM atlassian/nucleus

COPY config.js /opt/service/config.js
```

Then running your built docker image will run nucleus on port 8080.

### Manual

```bash
git clone https://github.com/atlassian/nucleus.git nucleus-server
cd nucleus-server
cp config.template.js config.js
yarn
yarn dev
```

This will launch Nucleus running on your local machine with a local
file store and a SQLite database.

## Configuration

All the config options are thoroughly documented and explained in the
[config.template.js](config.template.js) file in this repository.

## Uploading Releases

Release uploading is explained inside Nucleus itself, for more advanced
information check out the [Uploading Docs](docs/Uploading.md).

## More Information

Please see the following documents for more information on Nucleus and how it works.

* [Internal Endpoints](docs/Endpoints.md)
* [Uploading Releases](docs/Uploading.md)
* [Architecture](docs/Architecture.md)
* [Versioned Public API](docs/API.md)
* [Staged Rollouts](docs/Staged%20Rollouts.md)
* [Latest Releases](docs/Latest%20Releases.md)

## FAQ

### Why does this use a static file store, why not use a traditional update server?

$$$, static file stores quite simply cost less to run than arrays of update servers

### Can I use CloudFront to speed up my downloads?

Yes, check out the CloudFront section of the S3 config inside [config.template.js](config.template.js).

### How do I switch to this from Update Server X?

Switching update servers in an Electron app is quite simple

1. Modify your autoUpdater code to point to this server (follow the instructions
on your app page inside Nucleus)
2. Release a new update for your application on your existing update server with this change
3. Release all future updates on Nucleus :)

### Is this really awesome?

Pretty sure it is :D

### How do I set this up in a production environment?

You can use the published version of this module `nucleus-server` which has
an exported CLI command (`nucleus`).  You then run the command with the first
argument being a path to your config file.  E.g.

```bash
NODE_ENV=production nucleus path/to/config.js
```

Please ensure you add redis session config and a proper (not local) authentication
method when running in a production environment.

To enable logging you need to set `DEBUG=nucleus*`.

## System Requirements

* Node >= 8
* Yarn
* Linux
  * `createrepo`
  * `rpmsign`
  * `dpkg-scanpackages`
  * `dpkg-scansources`
  * `gpg`
  * `apt-ftparchive`
* macOS / Windows
  * `docker`
  * `gpg`

## Contributors

Pull requests, issues and comments welcome. For pull requests:

* Add tests for new features and bug fixes
* Follow the existing style
* Separate unrelated changes into multiple pull requests

See the existing issues for things to start contributing.

For bigger changes, make sure you start a discussion first by creating
an issue and explaining the intended change.

Atlassian requires contributors to sign a Contributor License Agreement,
known as a CLA. This serves as a record stating that the contributor is
entitled to contribute the code/documentation/translation to the project
and is willing to have it used in distributions and derivative works
(or is willing to transfer ownership).

Prior to accepting your contributions we ask that you please follow the appropriate
link below to digitally sign the CLA. The Corporate CLA is for those who are
contributing as a member of an organization and the individual CLA is for
those contributing as an individual.

* [CLA for corporate contributors](https://na2.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=e1c17c66-ca4d-4aab-a953-2c231af4a20b)
* [CLA for individuals](https://na2.docusign.net/Member/PowerFormSigning.aspx?PowerFormId=3f94fbdc-2fbe-46ac-b14c-5d152700ae5d)

## Team

| [![Samuel Attard](https://s.gravatar.com/avatar/1576c987b53868acf73d6ccb08110a78?s=144)](https://samuelattard.com) |
|---|
| [Samuel Attard](https://samuelattard.com) |

## License

Apache 2.0 © Atlassian Pty Ltd
