import * as path from 'path';
import * as semver from 'semver';

export interface MacOSRelease {
  version: string;
  updateTo: {
    version: string;
    pub_date: string;
    notes: string;
    name: string;
    url: string;
  };
}

export interface MacOSReleasesStruct {
  currentRelease: string;
  releases: MacOSRelease[];
}

export interface DarwinHelperOpts {
  app: NucleusApp;
  channel: NucleusChannel;
  arch: string;
  store: IFileStore;
}

export const generateDarwinReleasesStructure = async ({
  app,
  channel,
  arch,
  store,
}: DarwinHelperOpts, rollout = 100) => {
  const root = path.posix.join(app.slug, channel.id, 'darwin', arch);
  const versions: NucleusVersion[] = channel.versions
    .filter(v => !v.dead && v.rollout >= rollout)
    .filter((version) => {
      return version.files.find(
        f => f.fileName.endsWith('.zip')  && f.platform === 'darwin' && f.arch === 'x64',
      );
    });
  const releasesJson: MacOSReleasesStruct = {
    releases: [],
    currentRelease: '',
  };
  if (versions.length === 0) return releasesJson;

  let greatestVersion = versions[0];
  for (const testVersion of versions) {
    if (semver.gt(testVersion.name, greatestVersion.name)) {
      greatestVersion = testVersion;
    }
  }

  releasesJson.currentRelease = greatestVersion.name;

  for (const version of versions) {
    if (!releasesJson.releases.some(release => release.version === version.name)) {
      const zipFileInVersion = version.files.find(
        f => f.fileName.endsWith('.zip')  && f.platform === 'darwin' && f.arch === 'x64',
      )!;
      const zipFileKey = path.posix.join(root, zipFileInVersion.fileName);
      releasesJson.releases.push({
        version: version.name,
        updateTo: {
          version: version.name,
          // FIXME: We should store the creation date on the NucleusVersion
          pub_date: (new Date()).toString(),
          notes: '',
          name: version.name,
          url: encodeURI(`${await store.getPublicBaseUrl()}/${zipFileKey}`),
        },
      });
    }
  }

  return releasesJson;
};

export const updateDarwinReleasesFiles = async ({
  app,
  channel,
  arch,
  store,
}: DarwinHelperOpts) => {
  const root = path.posix.join(app.slug, channel.id, 'darwin', arch);
  const releasesKey = path.posix.join(root, 'RELEASES.json');
  const releasesJson = await generateDarwinReleasesStructure(
    {
      app,
      channel,
      arch,
      store,
    },
    0, // The default RELEASES.json file ignores all rollout numbers
  );
  await store.putFile(releasesKey, Buffer.from(JSON.stringify(releasesJson, null, 2), 'utf8'), true);

  for (let rollout = 0; rollout <= 100; rollout += 1) {
    const rolloutKey = path.posix.join(root, `${rollout}`, 'RELEASES.json');
    const json = await generateDarwinReleasesStructure(
      {
        app,
        channel,
        arch,
        store,
      },
      rollout,
    );
    await store.putFile(rolloutKey, Buffer.from(JSON.stringify(json, null, 2), 'utf8'), true);
  }
};
