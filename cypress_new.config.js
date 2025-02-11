const { defineConfig } = require('cypress')

module.exports = defineConfig({
  e2e: {
    baseUrl: "http://newdomain.com/",
    supportFile: false,
  },
})
