// 網頁版部署在子路徑(例如 GitHub Pages 的 /wordlee)時,用 EXPO_BASE_URL 指定。
// 本機開發不用設定。https://docs.expo.dev/more/expo-cli/#hosting-with-sub-paths
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  if (!baseUrl) return config;
  return { ...config, experiments: { ...config.experiments, baseUrl } };
};
