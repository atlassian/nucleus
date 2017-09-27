const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');

const publisher = (artifacts, packageJSON, forgeConfig, authToken, tag, platform, arch) =>
  new Promise((resolve, reject) => {
    const { nucleus } = forgeConfig;
    if (!nucleus) {
      return reject('You must set the nucleus config option to use the nucleus publisher');
    }
    if (!nucleus.appId) {
      return reject('You must set the nucleus.appId config option to use the nucleus publisher');
    }
    if (!nucleus.channelId) {
      return reject('You must set the nucleus.channelId config option to use the nucleus publisher');
    }
    if (!nucleus.token) {
      return reject('You must set the nucleus.token config option to use the nucleus publisher');
    }
    if (!nucleus.host) {
      return reject('You must set the nucleus.host config option to use the nucleus publisher');
    }

    const data = new FormData();
    data.append('platform', platform);
    data.append('arch', arch);
    data.append('version', packageJSON.version);
    let i = 0;
    for (const artifactPath of artifacts) {
      // Skip the RELEASES file, it is automatically generated on the server
      if (path.basename(artifactPath).toLowerCase() === 'releases') continue;
      data.append('file' + i, fs.createReadStream(artifactPath));
      i++;
    }

    console.info('Starting upload to Nucleus');
    fetch(`${nucleus.host}/rest/app/${nucleus.appId}/channel/${nucleus.channelId}/upload`, {
      headers: {
        Authorization: nucleus.token,
      },
      method: 'POST',
      body: data,
    }).then((response) => {
      if (response.status === 200) {
        console.info('Upload Successful');
        return resolve();
      }
      response.text().then((text) => {
        reject(`Unexpected response code from Nucleus: ${response.status}\n\nBody:\n${text}`);
      });
    }).catch(err => reject(err));
  });

module.exports = publisher;