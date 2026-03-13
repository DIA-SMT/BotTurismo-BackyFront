module.exports = {
  apps: [{
    name: "bot-turismo-smt",
    script: "./src/index.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}
