# WebHooks

## Registering a WebHook

WebHooks are registered on a per-app level on the app configuration screen
inside nucleus.

## WebHook Details

### Validating a web hook's origin

When you create a WebHook you will receive a secret string, we will send that
string in the `Authorization` header of our request.  You should validate this
yourself to ensure you aren't receiving bogus information.

### WebHook Body

All WebHook requests we send will be `POST` requests with a `Content-Type` of
`application/json`.

#### WebHook Registered

```js
{
  type: 'register',
  nucleusOrigin: String,
  app: {
    id: Number,
    name: String,
    slug: String
  }
}
```

#### WebHook Unregistered

```js
{
  type: 'unregister',
  nucleusOrigin: String,
  app: {
    id: Number,
    name: String,
    slug: String
  }
}
```

#### Channel Created

```js
{
  type: 'channel_created',
  nucleusOrigin: String,
  app: {
    id: Number,
    name: String,
    slug: String
  },
  channel: {
    id: String,
    name: String
  }
}
```

#### Version Created

```js
{
  type: 'version_created',
  nucleusOrigin: String,
  app: {
    id: Number,
    name: String,
    slug: String
  },
  channel: {
    id: String,
    name: String
  },
  version: {
    name: String
  }
}
```

#### Version File Uploaded

Please note that the `files` array in the object below will include
**all** files that have been uploaded into that version, not just
the ones that caused this hook to fire.

Also if multiple files are uploaded simultaneously this hook will
only be called once with multiple new files in the files array.

```js
{
  type: 'version_file_uploaded',
  nucleusOrigin: String,,
  app: {
    id: Number,
    name: String,
    slug: String
  },
  channel: {
    id: String,
    name: String
  },
  version: {
    name: String,
    files: [{
      fileName: String,
      platform: String,
      arch: String,
      type: 'installer' | 'update'
    }]
  }
}
```