### 0.6.0 (2018-05-15)

##### Documentation Changes

* **tooling:** document system reqs for running nucleus now we hava GPG support (a8f2cc85)

##### New Features

* remove nucleus-uploader as the publisher now lives in electron-forge (6d8f4a16)
* **core-platform:** initialize empty versions.json file when a channel is created (b19af837)

##### Bug Fixes

* **public:** remove bad closing bracket from update usage (40297add)

#### 0.5.1 (2018-03-26)

##### Chores

* **tooling:** ignore sqlite on publish (287ef73e)

### 0.5.0 (2018-03-26)

##### Chores

* **tooling:** enable strict ts options (add027ca)

##### Documentation Changes

* **core-platform:** document the new organization and gpgSigningKey properties in the config file (f7f3fb8b)

##### New Features

* **core-platform:**
  * enable gpg signing of RPM's released through the yum repo (af4b54d4)
  * host the public key of the gpg key pair on the file store (d1c155e6)
* **public:** show gpg public key usage for apt and yum (f7da3f37)

#### 0.4.1 (2018-03-23)

##### Bug Fixes

* **core-platform:** fix gzip arg usage (a4ec1504)

### 0.4.0 (2018-03-23)

##### New Features

* **core-platform:**
  * sign releases in the apt repo (87e34a6e)
  * add support for apt repos for .deb linux uploads (4367b9c0)
  * create the .repo file when we upload new releases as well so that existing chan (8f4ab9bd)
  * add support for hosting RPM files in a yum repo (f4bb2eb9)
* **public:** show yum repo usage on the app page (ebbc83f3)

##### Bug Fixes

* **tests:**
  * disable linux positioner tests till we test linuxHelpers properly (6d4d29ee)
  * take into account lock lookups in Positioner tests (49033489)
* **core-platform:**
  * getPublicBaseUrl() is a promise, we must await it to get the string value (adda4c1b)
  * fix lock not being released, make sure we use per-app locking (d5539f05)
  * clean up temp yum directories once done (2d0697be)
  * add locking to the releasing of files to ensure two releases cant run at the sam (ea2c1ea5)
* **file-store:** fix LocalStore error when the path we try to listFiles from does not exist (407a8092)
* **tooling:** fix broken build, Positioner calls now need a lock (1b783101)
* **public:** fix docs for squirrel.mac json server impl in electron (f5180d95)

##### Refactors

* **core-platform:** added a listFiles helper method to all stores (b491d086)

#### 0.2.1 (2018-03-05)

##### Bug Fixes

* **public:** fix app card height being capped and the card overflowing (4d55f572)
* **tooling:** fix typo in webpack config (4ab6efcb)
* **db:** handle case where the database has not been created yet (f3492f3c)

##### Refactors

* **uploader:** update uploader to support new publisher syntax for forge@5 (61ce5457)

### 0.2.0 (2017-12-15)

##### New Features

* **core-platform:** add support for rollout percentages in the versions file (93cf73dc)

### 0.1.0 (2017-11-27)

##### New Features

* **core-platform:**
  * write dead/revived changes to the versions file so apps can poll for changes (9864701d)
  * add ability to declare some versions as "dead" (0df3e748)

##### Bug Fixes

* **public:**
  * fix linting issues in death logic (12ceeeea)
  * order versions correctly, regardless of creation order (30ebd0c0)

#### 0.0.5 (2017-11-23)

##### Bug Fixes

* **core-platform:** encode URIs in the darwin JSON file (53745606)
* **public:** fix My Applications link in user menu (56bc7238)

#### 0.0.4 (2017-11-22)

##### Bug Fixes

* **core-platform:** fix config not loading in development (661280a2)

#### 0.0.3 (2017-11-22)

##### Chores

* **tooling:**
  * also push to origin after a release script is run (2952d46f)
  * add patch/minor/major release logic to auto-generate changelog from commits (456e8af4)
  * add commitizen setup for automated nice commit messages (6dc89f34)
* **test:** clean up tests for file stores so we don't have to mock the config object (c29f5761)
* **build:** Enable Travis CI (b9eb2d66)

##### Bug Fixes

* **test:** Fix config erroring when running tests (cede0570)

