import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { C } from '@/lib/theme';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

/** iOS 用 SF Symbols,Android/網頁用 Material Symbols。 */
const ICONS = {
  game: { ios: 'square.grid.3x3.fill', android: 'grid_view', web: 'grid_view' },
  battle: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
  cards: { ios: 'rectangle.stack.fill', android: 'style', web: 'style' },
  trophy: { ios: 'trophy.fill', android: 'trophy', web: 'trophy' },
  book: { ios: 'book', android: 'menu_book', web: 'menu_book' },
  stats: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  help: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  backspace: { ios: 'delete.left', android: 'backspace', web: 'backspace' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  bookmark: { ios: 'bookmark', android: 'bookmark_add', web: 'bookmark_add' },
  bookmarked: { ios: 'bookmark.fill', android: 'bookmark_added', web: 'bookmark_added' },
  speaker: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  refresh: { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  flip: { ios: 'arrow.triangle.2.circlepath', android: 'cached', web: 'cached' },
  shuffle: { ios: 'shuffle', android: 'shuffle', web: 'shuffle' },
  person: { ios: 'person.fill', android: 'person', web: 'person' },
  group: { ios: 'person.2.fill', android: 'group', web: 'group' },
  copy: { ios: 'doc.on.doc', android: 'content_copy', web: 'content_copy' },
  left: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  right: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  timer: { ios: 'timer', android: 'timer', web: 'timer' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  wifiOff: { ios: 'wifi.slash', android: 'wifi_off', web: 'wifi_off' },
  crown: { ios: 'crown.fill', android: 'crown', web: 'crown' },
  spell: { ios: 'textformat.abc', android: 'spellcheck', web: 'spellcheck' },
  hint: { ios: 'lightbulb', android: 'lightbulb', web: 'lightbulb' },
} satisfies Record<string, SymbolName>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color = C.text }: { name: IconName; size?: number; color?: ColorValue }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}
