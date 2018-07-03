# Public API

Although the Nucleus service has several REST endpoints and puts files in
specific locations on your file store only a few of these things are
considered "Public API" and will be versioned / migrated appropriately.

The following API's, concepts and contracts are considered "Public API":

* The [Upload Endpoint](Uploading.md)
* The [healthcheck and deepcheck endpoints](Endpoints.md)
* The style of the generated path to the icons files
  * `/:appSlug/icon.png`
  * `/:appSlug/icon.ico`
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
* The style of the generated path to the "Latest" releases
  * `/:appSlug/:channelId/latest/:platform/:arch/:appName.:extension`

The version of Nucleus will follow [Semantic Versioning]()
according to the impact on the above Pulic API.  I.e. Breaking changes will
result in a Major bump.

Breaking changes will normally come with a migration tool built in to Nucleus
but it is not guarunteed.  You may have to do migrations for major versions
manually.

To further clarify this document outlines our goals, it is not an implicit
contract or promise.  This is simply what we **aim** to achieve.