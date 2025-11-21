import { Signer } from '@aws-sdk/rds-signer'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'

export async function generateRdsAuthToken(config) {
  const signer = new Signer({
    hostname: config.host,
    port: config.port,
    region: config.awsRegion,
    username: config.username,
    credentials: fromNodeProviderChain()
  })
  return signer.getAuthToken()
}
