export const SET_APPS = 'SET_PLUGINS';

const APP_REST_ENDPOINT = '/rest/app';

export const fetchApps = async (): Promise<NucleusApp[]> => {
  const apps: any[] = await (await fetch(APP_REST_ENDPOINT, { credentials: 'include' })).json();
  return apps.map((app) => {
    return app;
  });
};

export const setApps = (apps: NucleusApp[]) => ({
  apps,
  type: SET_APPS,
});
