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

