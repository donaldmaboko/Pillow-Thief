module.exports = function (api) {
  api.cache(true)
  // babel-preset-expo wires the Reanimated/worklets transform automatically
  // when react-native-reanimated is installed — do not add it twice.
  return {
    presets: ['babel-preset-expo'],
  }
}
