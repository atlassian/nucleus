#### 1.1.3 (2018-09-18)

##### Bug Fixes

* sanitze the cloudfront key for all uses (6ce54edc)

#### 1.1.2 (2018-09-18)

##### Bug Fixes

* encode the URI when invalidating cache for cloudfront (a4db8975)

#### 1.1.1 (2018-08-21)

##### New Features

* **api:** add new invalidate-cache REST endpoint (65f900a8)

##### Bug Fixes

* stringify team before sending (e17f5266)
* **file-store:**
  * invalidate 500 things at a time (88049123)
  * only add each item to the invalidation queue once (c44b66de)
  * invalidate less things and log properly (68641006)
* **api:** handle not logged in users, send response when wiping cache (bb3c7492)

#### 1.0.2 (2018-06-29)

##### Bug Fixes

* **public:** fix linting in public, badly used interface names (073c35a8)

#### 1.0.1 (2018-06-29)

##### Documentation Changes

* declare v0.8.3 as the "stable" release (670dc3d3)

##### Bug Fixes

* **public:** remove 2 second delay on migration (7dcdb02d)

## 1.0.0 (2018-06-29)

##### New Features

* **public:**
  * add migrator to the front end (491ca9df)
  * add MSI support and document the latest download URL usage (aad87f03)
  * use the file index as the download URL for pubblic files (52b868b0)
* **core-platform:**
  * add noPendingMigrations helper to enforce migrations rules for rest endpoints (b57ba19c)
  * only move files to their "latest" location if rollout is 100% (65b31817)
  * add a "latest" installer for each app channel (da51d44f)
  * deterministicly generate the RELEASES.json file for the darwin platform (4bc546c6)
* add Migration logic (237e505c)
* **file-store:** add new hasFile method to filestores to assist with migrations for the _index file (0e504724)

##### Bug Fixes

* **core-platform:**
  * add version validation to the rollout REST API (3eb50bd3)
  * move files to latest in rollout update API with a lock (1af68811)

##### Refactors

* **core-platform:** update Positioner class to use files instead of stray information (61e229e7)

##### Tests

* **core-platform:** add tests for FileIndexMigration (7238f9f6)

#### 0.8.3 (2018-06-28)

##### Performance Improvements

* reduce docker image size by ~500MB (34748858)

#### 0.8.1 (2018-05-24)

##### Bug Fixes

* **core-platform:** make withLock release the lock when successful (8314b7ab)

### 0.8.0 (2018-05-24)

##### New Features

* **core-platform:** add admin-only endpoint for clearing all existing locks (ba5b8b1e)

#### 0.7.5 (2018-05-22)

##### Bug Fixes

* **core-platform:** fix build due to missing new lines (7fdb3667)

#### 0.7.4 (2018-05-22)

##### Bug Fixes

* **public:**
  * fix mis-render of multiple draft versions showing the wrong file (51d377d0)
  * public downloadd URL for linux assets are slightly different to other platforms (6e723ee9)
* **tooling:** make launch static work on windows (5b9edaeb)
* **core-platform:** improve resiliance to errors during release process (c5400423)

##### Refactors

* **core-platform:** split liunux-helpers to more generic utils (d53b9e2f)

#### 0.7.3 (2018-05-21)

##### Bug Fixes

* **core-platform:** fix tests for locking app ops (5d05ae26)

#### 0.7.2 (2018-05-21)

##### Bug Fixes

* **core-platform:**
  * allow locks to be given and released (cece6b64)
  * add positioner lock tests and fix multi-app locking bug (4bcd2f74)

#### 0.7.1 (2018-05-21)

##### Bug Fixes

* add missing apt deps to docker image (d8596c2f)

### 0.7.0 (2018-05-21)

##### Documentation Changes

* document the new docker image (4790962d)

##### New Features

* automated docker builds of nucleus (f4b26f79)

##### Bug Fixes

* docker login env var (cffa6474)
* docker login does not need email (6f1b1757)
* use shorted commit name for tag on docker build (8300dc80)

#### 0.6.2 (2018-05-18)

##### Bug Fixes

* **core-platform:** gpg import on linux throws error even when successful (b3a0c258)

#### 0.6.1 (2018-05-18)

##### New Features

* **core-platform:** add validation of the GPG key to ensure users provide one and it is valid (5a8432b9)

##### Bug Fixes

* **api:** handle file uploads of larger than 100MB (969fc0c1)

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

