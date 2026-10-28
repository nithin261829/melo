import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/tabs';
import { View, type ColorValue } from 'react-native';
import MiniPlayer from '../../ui/MiniPlayer';
import { colors } from '../../ui/theme';

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? name : (`${name}-outline` as keyof typeof Ionicons.glyphMap)} size={24} color={color as string} />
  );

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.faint,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border },
        tabBarLabelStyle: { fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bg },
      }}
      tabBar={(props) => (
        <View style={{ backgroundColor: colors.bg }}>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="melodi" options={{ title: 'Melodi AI', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: icon('search') }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: icon('library') }} />
    </Tabs>
  );
}
