module.exports = {
  apps: [
    {
      name: 'riden74-api',
      cwd: '/var/opt/backend',
      script: 'dist/main.js',
      node_args: '-r ./ws-polyfill.cjs',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: '512M',
    },
  ],
};
