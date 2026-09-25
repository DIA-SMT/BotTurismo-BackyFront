module.exports = {
  apps: [
    {
      name: "bot-turismo-smt",
      script: "./src/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    },
    {
      // Long polling: una sola instancia por token (instances: 1, sin cluster).
      name: "bot-turismo-telegram",
      script: "./src/telegram.js",
      instances: 1,
      exec_mode: "fork",
      // Da tiempo a terminar las respuestas en curso al reiniciar (el bot espera hasta 25 s).
      kill_timeout: 30000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}