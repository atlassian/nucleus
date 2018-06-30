# Public API

Although the Nucleus service has several REST endpoints and puts files in
specific locations on your file store only a few of these things are
considered "Public API" and will be versioned / migrated appropriately.

The following API's, concepts and contracts are considered "Public API":

* The [Upload Endpoint](Uploading.md)
* The [healthcheck and deepcheck endpoints](Endpoints.md)
* The style of the generated path to the `RELEASES` file
  * `/:appSlug/:channelId/win32/:arch/RELEASES`
* The style of the generated path to the `RELEASES.json` files
  * `/:appSlug/:channelId/darwin/:arch/RELEASES.json`
  * `/:appSlug/:channelId/darwin/:arch/:rollout/RELEASES.json`
* The style of the generated path to Debian repo
  * `/:appSlug/:channelId/linux/debian/binary`
* The style of the generated path to Redhat repo
  * `/:appSlug/:channelId/linux/redhat`
  * `/:appSlug/:channelId/linux/:appSlug.repo`