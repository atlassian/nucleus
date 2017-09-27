# Internal Endpoints

## `/healthcheck`

Method: GET
Authentication: None

This endpoints performs no tasks and simply returns immediately with 200 OK.
You should use it to determine if Nucleus is still alive and running.

## `/deepcheck`

Method: GET
Authentication: None

This endpoint performs two simple checks to ensure Nucleus is configured correctly.

* A database connection test, simply attempts to connect to the configured DB
* A file store connection test, simply attempts to put, get and delete files in the store

You should only use this endpoint when you first launch Nucleus to validate your
config is OK and Nucleus will operate successfully.  If you get any response that isn't
200 OK something went wrong.

## `/rest/app/:appId/channel/:channelId/upload`

See the [Uploading Docs](Uploading.md) for more information on this endpoint
