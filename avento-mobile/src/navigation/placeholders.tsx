/**
 * Navigation placeholder screens.
 *
 * ⚠️ These are TEMPORARY stubs that exist only so the role-based tab navigators
 * (task 6.2) compile and render every route in the design's Screen Inventory.
 * The REAL screen components are owned by later tasks:
 *
 *   - Parent screens .......... tasks 9.x  (src/screens/parent, src/screens/shared)
 *   - Admin screens ........... tasks 11.x–12.x (src/screens/admin, src/screens/shared)
 *   - SuperAdmin screens ...... task 14.x (src/screens/superadmin, src/screens/shared)
 *
 * They are deliberately kept in the navigation folder (NOT under src/screens)
 * so they never clobber the real screen files being authored in parallel. Once
 * the owning tasks land their screens, swap the imports in the tab navigators
 * to point at the real components and delete the matching entries here.
 *
 * Each placeholder renders a tiny labelled View whose testID/text is the screen
 * name, which keeps component tests able to assert "the right screen mounted".
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 */

import { StyleSheet, Text, View } from 'react-native';

/**
 * Build a minimal placeholder screen component for the given route name.
 * The rendered text and testID are the route name so tests can target it.
 */
export function makePlaceholderScreen(name: string): () => JSX.Element {
  function PlaceholderScreen(): JSX.Element {
    return (
      <View style={styles.container} testID={`placeholder-${name}`}>
        <Text style={styles.text}>{name}</Text>
        <Text style={styles.note}>Placeholder — real screen built later</Text>
      </View>
    );
  }
  PlaceholderScreen.displayName = `Placeholder(${name})`;
  return PlaceholderScreen;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  text: { fontSize: 18, fontWeight: '600', color: '#111' },
  note: { fontSize: 12, color: '#888', marginTop: 6 },
});
