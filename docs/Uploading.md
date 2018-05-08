# Uploading Releases

## Easy Way

The easiest way to upload releases to Nucleus is to use [`electron-forge`](https://github.com/electron-userland/electron-forge)
to build and publish your application.  You will find the config required
on your App's page inside Nucleus.

Check out the publisher documentation at [https://v6.electronforge.io/publishers/nucleus](https://v6.electronforge.io/publishers/nucleus)

## Custom Way

There is a upload endpoint inside Nucleus, you simply hit it with the
parameters outlined below as a POST request with a FormData body.

```
POST: /rest/app/:appId/channel/:channelId/upload
Headers:
  Authorization: <AppAuthorizationToken>
BODY:
  platform: String - One of 'darwin', 'win32' and 'linux'
  arch: String - One of 'ia32' and 'x64'
  version: String
FILES:
  <AnyString>: File
```

Please note that any files you wish to release must be attached to
the body of the request, you can use any key you want to add the
file to the body.

Any non-200 status code means something went wrong, a helpful error
message is normally included in the response.

See the [Nucleus Publisher](https://github.com/electron-userland/electron-forge/blob/master/packages/publisher/nucleus/src/PublisherNucleus.ts) for a JS code example of uploading to Nucleus.