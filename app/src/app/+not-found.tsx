import { Redirect } from 'expo-router';

/** 找不到的網址（例如網頁版放在子路徑下）一律回到首頁。 */
export default function NotFound() {
  return <Redirect href="/" />;
}
