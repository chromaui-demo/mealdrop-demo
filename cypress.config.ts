import { defineConfig } from 'cypress'
const { installPlugin } = require('@chromatic-com/cypress')

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      installPlugin(on, config)
      // implement node event listeners here
    },
  },
})
