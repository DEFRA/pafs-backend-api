import { SQSClient } from '@aws-sdk/client-sqs'
import { config } from '../../../config.js'

export const sqsClientPlugin = {
  name: 'sqsClient',
  version: '1.0.0',
  register(server) {
    const endpoint = config.get('sqsEndpoint')
    const clientConfig = { region: config.get('awsRegion') }
    if (endpoint) {
      clientConfig.endpoint = endpoint
    }
    const client = new SQSClient(clientConfig)
    server.decorate('server', 'sqs', client)
    server.events.on('stop', () => {
      server.logger.info('Closing SQS client')
      client.destroy()
    })
  }
}
