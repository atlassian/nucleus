import * as path from 'path';
import * as semver from 'semver';
import Positioner from '../Positioner';

export interface Win32HelperOpts {
  app: NucleusApp;
  channel: NucleusChannel;
  arch: string;
  store: IFileStore;
  positioner: Positioner;
}

export const generateWin32ReleasesStructure = async ({
  app,
  channel,
  arch,
  store,
  positioner,
}: Win32HelperOpts, rollout = 100) => {
  const root = path.posix.join(app.slug, channel.id, 'win32', arch);

  const versions: NucleusVersion[] = channel.versions
    .filter(v => !v.dead && v.rollout >= rollout);

  if (versions.length === 0) return '';
  const releases: string[] = [];

  for (const version of versions.sort((a, b) => semver.compare(a.name, b.name))) {
    for (const file of version.files) {
      if (file.fileName.endsWith('-full.nupkg') || file.fileName.endsWith('-delta.nupkg')) {
        const fileSize = await store.getFileSize(positioner.getIndexKey(app, channel, version, file));
        const absoluteUrl = `${await store.getPublicBaseUrl()}/${root}/${file.fileName}`;
        releases.push(
          `${file.sha1.toUpperCase()} ${absoluteUrl} ${fileSize}`,
        );
      }
    }
  }

  return releases.join('\n');
};

export const updateWin32ReleasesFiles = async ({
  app,
  channel,
  arch,
  store,
  positioner,
}: Win32HelperOpts) => {
  const root = path.posix.join(app.slug, channel.id, 'win32', arch);
  const releasesKey = path.posix.join(root, 'RELEASES');
  const releases = await generateWin32ReleasesStructure(
    {
      app,
      channel,
      arch,
      store,
      positioner,
    },
    0, // The default RELEASES file ignores all rollout numbers
  );
  await store.putFile(releasesKey, Buffer.from(releases, 'utf8'), true);

  for (let rollout = 0; rollout <= 100; rollout += 1) {
    const rolloutKey = path.posix.join(root, `${rollout}`, 'RELEASES');
    const rolloutReleases = await generateWin32ReleasesStructure(
      {
        app,
        channel,
        arch,
        store,
        positioner,
      },
      rollout,
    );
    await store.putFile(rolloutKey, Buffer.from(rolloutReleases, 'utf8'), true);
  }
};
