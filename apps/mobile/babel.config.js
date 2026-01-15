module.exports = (api) => {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      '@babel/plugin-proposal-export-namespace-from',
      'react-native-worklets/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            utils: './src/utils',
            slices: './src/slices',
            theme: './src/theme',
            components: './src/components',
            scenes: './src/scenes',
            routes: './src/routes',
            contexts: './src/contexts',
          },
        },
      ],
      'react-native-reanimated/plugin',
    ],
  }
}
