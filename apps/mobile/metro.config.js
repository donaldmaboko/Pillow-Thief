// Monorepo metro config: watch the shared package so imports from
// @pillow-thief/shared (file: link) resolve and hot-reload.
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
// The shared package ships TypeScript sources; Metro handles them directly.
config.resolver.sourceExts = [...config.resolver.sourceExts, 'ts', 'tsx']

module.exports = config
