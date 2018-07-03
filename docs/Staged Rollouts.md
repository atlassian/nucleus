# Staged Rollouts

Nucleus has built in support for staged rollouts on some platforms. Currently
we support Staged Rollouts on `darwin` and `win32`.

Linux support for staged rollouts is **unlikely** to ever happen, you should
take this into account when shipping new releases.  As soon as you release
new linux updates, 100% of your users will be eligible to get them regardless
of your rollout setting.

## How do I control the rollout of a version?

By default all versions will have a `0%` rollout (with the exception of the
first version for any channel, that will have a `100%` rollout).  You can
update the rollout for any version by navigating to it in the Nucleus UI
and clicking `Edit` next to the rollout percentage.

**NOTE:** You can't update the rollout of some versions due to restrictions
imposed by the [Latest Releases](Latest Releases.md) feature.  See that doc
for more information

## How do I utilize staged rollouts

The non-staged version of the `RELEASES.json` file for macOS can be found at a
path that looks something like this:

```
/:appSlug/:channelId/darwin/:arch/RELEASES.json
```

If you want to use staged rollouts, you just need to add a rollout percentage
before `RELEASES.json`.  The percentage **must** be an integer number between
0 and 100 inclusive.  Any other number will cause a 404 and result in broken
updates.  It **MUST** be an integer.  For example a valid staged update URL
would be:

```
/:appSlug/:channelId/darwin/:arch/47/RELEASES.json
```

You should generate the staged rollout numbebr to use client side in your
application.