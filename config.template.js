const path = require('path');

module.exports = {
  /**
   * The port to run Nucleus Server on, if the port is in use the server will not start
   */
  port: 3030,

  /**
   * The fully qualified domain + path that Nucleus is being hosted at
   */
  baseURL: 'http://localhost:8888',

  /**
   * The data store to use when persisting plugins and versions.  Current possible values
   * are "sequelize", ensure you also supply valid connection details for your
   * chosen strategy below.
   *
   * PR's welcome to add another data store.
   */
  dbStrategy: 'sequelize',

  /**
   * Sequelize connection information, please note all options are required
   *
   * database: The name of the database to connect to
   * dialect: The type of SQL database this is, check sequelize docs for more info
   * username: Username to use when connecting
   * password; Password to use when connecting
   * host: Hostname of database
   * port: Port to use when connecting
   * storage: Path to sqlite file, only used for sqlite dialect
   */
  sequelize: {
    dialect: 'sqlite',
    storage: path.resolve(__dirname, 'db.sqlite'),
  },

  /**
   * The file store to use when persisting update files and metadata.  Current possible
   * values are "s3" and "local" ensure you also supply valid connection details if
   * required for your chosen strategy below.
   *
   * PR's welcome to add another file store.
   */
  fileStrategy: 'local',

  /**
   * Local file configuration
   *
   * root: Path on disk to the root of the static file store
   * staticUrl: The HTTP url to use to access the static file store remotely
   */
  local: {
    root: path.resolve(__dirname, '.files'),
    staticUrl: 'http://localhost:9999'
  },

  /**
   * There is actually no authentication config for s3, all config must be done through the standard AWS
   * environment variables or through EC2 IAM roles.
   *
   * See http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html
   *
   * Bucket / Region / CloudFront config goes here though
   */
  s3: {
    // init: {
    //   endpoint: '' // The alternate endpoint to reach the S3 instance at,
    //   s3ForcePathStyle: true // Always use path style URLs
    // }

    bucketName: '', // The name for your S3 Bucket

    cloudfront: { // If you don't have CloudFront set up and just want to use the S3 bucket set this to "null
      distributionId: '', // The CloudFront distribution ID, used for invalidating files
      publicUrl: '', // Fully qualified URL for the root of the CloudFront proxy for the S3 bucket
    }
  },

  /**
   * The authentication strategy to use when logging users in.  Current possible values are "local",
   * "openid" and "github".  Make you also supply the required authentication details
   */
  authStrategy: 'local',

  /**
   * Local authentication details
   *
   * The `adminIdentifiers` array should be a list of usernames
   *
   * DISCLAIMER: This strategy should ONLY be used for local development and NEVER
   * used in production.  Unicorns cry every time this setting is used in production.
   * Don't make the unicorns cry.
   *
   * displayName: The user friendly name of this user
   * username: A unique identifier to use when this user signs in, please note uniqueness is
   *           not enforced
   * password: Well, uhhh, their password
   * photo: A URL for their profile, entirely optional, just makes things look nicer ;)
   */
  localAuth: [{
    displayName: 'Charlie',
    username: 'charlie',
    password: 'charlie',
    photo: 'https://pbs.twimg.com/profile_images/1219364727/charlie-support_400x400.png'
  }],

  /**
   * OpenID authentication details
   *
   * The `adminIdentifiers` array should be a list of email
   * addresses for users to consider admins
   *
   * realm: The domain that the server is hosted on
   * stateless: Stateless mode for openID
   * profile: Whether to fetch profile information, should normally be true
   * providerURL: Your openID provider URL
   * domain: Domain to restrict email addresses to
   */
  openid: {
    realm: 'http://localhost:8888',
    stateless: true,
    profile: true,
    providerURL: 'https://auth.myservice.com/openid/v2/op',
    domain: 'myservice.com'
  },

  /**
   * GitHub authentication details
   *
   * The `adminIdentifiers` array should be a list of GitHub usernames
   * to consider admins
   *
   * clientID: GitHub API client ID
   * clientSecret: GitHub API clientSecret
   * realm: The domain the server is hosted on
   */
  github: {
    clientID: '',
    clientSecret: ''
  },

  /**
   * See the documentation for your authentication strategy for what this array does
   */
  adminIdentifiers: ['admin@yourdomain.com', 'charlie'],

  /**
   * Session options, in development just leave this as default.
   *
   * IN PRODUCTION PLEASE USE REDIS!
   *
   * type: Can be either "redis" or null
   *
   * redis:
   *   host: The host URL for the redis instance
   *   port: The port for the redis instance
   */
  sessionConfig: {
    type: null,
    secret: 'ThisIsNotSecret',

    redis: {
      host: '',
      port: ''
    }
  },

  organization: 'My Company Here',

  /**
   * GPG key to use when signing APT and YUM releases
   *
   * Requires to be unlocked (no password) and have both the private and
   * public key.
   */
  gpgSigningKey: 'GPG KEY HERE',

  /**
   * The default percentage rollout for new releases.  The first release for
   * any channel will always be 100% but all future releases will have a
   * default rollout value of this setting
   */
  defaultRollout: 0
};
