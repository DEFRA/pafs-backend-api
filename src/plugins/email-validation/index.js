import validateEmail from './validate-email.js'

const emailValidationPlugin = {
  name: 'email-validation',
  version: '1.0.0',
  register: (server, _options) => {
    server.route([validateEmail])
    server.logger.info('Email validation plugin registered')
  }
}

export default emailValidationPlugin
export { default as validateEmail } from './validate-email.js'
