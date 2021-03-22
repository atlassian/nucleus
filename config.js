const AWS = require("aws-sdk");

module.exports = {
  /**
   * The port to run Nucleus Server on, if the port is in use the server will not start
   */
  port: 8080,

  /**
   * The fully qualified domain + path that Nucleus is being hosted at
   */
  baseURL: `https://${process.env.NUCLEUS_HOSTNAME}`,

  /**
   * The data store to use when persisting plugins and versions.  Current possible values
   * are "sequelize", ensure you also supply valid connection details for your
   * chosen strategy below.
   *
   * PR's welcome to add another data store.
   */
  dbStrategy: "sequelize",

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
    dialect: "mysql",
    database: "nucleus",
    username: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    host: process.env.MYSQL_HOST,
    port: "3306",
  },

  /**
   * The file store to use when persisting update files and metadata.  Current possible
   * values are "s3" and "local" ensure you also supply valid connection details if
   * required for your chosen strategy below.
   *
   * PR's welcome to add another file store.
   */
  fileStrategy: "s3",

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
    //   endpoint: "https://roam-nucleus-test.s3.us-east-2.amazonaws.com", // The alternate endpoint to reach the S3 instance at,
    //   s3ForcePathStyle: true, // Always use path style URLs
    // },
    init: {
      credentials: new AWS.ECSCredentials(),
      region: 'us-east-2',
    },

    bucketName: process.env.S3_BUCKET_DOWNLOADS_BUCKET,

    cloudfront: {
      distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
      publicUrl: process.env.CLOUDFRONT_S3_URL_PREFIX,
    },
  },

  /**
   * The authentication strategy to use when logging users in.  Current possible values are "local",
   * "openid" and "github".  Make you also supply the required authentication details
   */
  authStrategy: "github",

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
    clientID: process.env.GITHUB_CLIENTID,
    clientSecret: process.env.GIBHUB_CLIENT_SECRET,
  },

  /**
   * See the documentation for your authentication strategy for what this array does
   */
  adminIdentifiers: process.env.GITHUB_USERNAMES.split(',').map(Function.prototype.call, String.prototype.trim),

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
    // type: "redis",
    secret: process.env.NUCLEUS_SESSION_SECRET,

    // redis: {
    //   host: "nucleus-unencrypted.swe0ir.ng.0001.use2.cache.amazonaws.com",
    //   port: "6379",
    // },
  },

  organization: "Wonder, Inc.",

  /**
   * GPG key to use when signing APT and YUM releases
   *
   * Requires to be unlocked (no password) and have both the private and
   * public key.
   */
  gpgSigningKey: process.env.GPG_SIGNING_KEY,

  /**
   * The default percentage rollout for new releases.  The first release for
   * any channel will always be 100% but all future releases will have a
   * default rollout value of this setting
   */
  defaultRollout: 0,
};

