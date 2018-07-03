# Latest Releases

Nucleus has built in support for providing a static "latest" release download
URL that will work and automatically update whenever you release a new version.

This URL is in the following format:

```
{staticFileBaseUrl}/:appSlug/:channelId/latest/:platform/:arch/:appName.{extension}

# Example

https://update.myapp.com/my-app/123/latest/darwin/x64/My App.dmg
```

Any file uploaded to a given version on Nucleus which we consider an "installer"
file will be positioned at that path with it's extesnion.  The file types we
currently consider installers are:

* `.dmg`
* `.pkg`
* `.exe`
* `.msi`
* `.deb`
* `.rpm`

For a given extension the file you will find at it's "latest" path will be the
file from the version with the "highest" (according to semver) version number
that meets the following criteria:

* The version must not be flagged as `dead`
* The version must be at `100%` rollout

# Impact on other Nucleus Functionality

In order to be Strongly Consistent and avoid scenarios where no user can
install your application the following restrictions take affect on other
nucleus features.

* Once a version is at `100%` rollout you can not change it's rollout
  again
* You can't mark a version at 100% rollout as dead if there is no newer
  non-dead version at 100% rollout as well

# Weird things you may notice

It is possible depending on how you release your app for the latest `.dmg`
installer to be a completely different version to the latest `.exe` installer.
This is because we will not **delete** a file from the static file store, we
only ever overwrite existing files.  This means that if you are currently at
version `1.0.0` and release a `.dmg` file in `1.0.1` and nothing else the DMG
file will be updated bubt the `.exe` file will remain pointing at `1.0.0` until
you release a newer EXE file.