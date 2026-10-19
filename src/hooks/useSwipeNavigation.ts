import { useRouter, usePathname } from 'expo-router';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export const TAB_ROUTES = ['/', '/chats', '/settings'] as const;

export function useSwipeNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const currentIndex = TAB_ROUTES.findIndex((route) => {
    if (route === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname.startsWith(route);
  });

  const navigateTo = (targetRoute: string) => {
    router.replace(targetRoute as any);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-25, 25])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      'worklet';
      const threshold = 50;
      const velocity = 300;

      // Swiping Left (finger moves left, translationX < 0) -> Next Tab
      if (e.translationX < -threshold || e.velocityX < -velocity) {
        if (currentIndex >= 0 && currentIndex < TAB_ROUTES.length - 1) {
          const nextRoute = TAB_ROUTES[currentIndex + 1];
          runOnJS(navigateTo)(nextRoute);
        }
      }
      // Swiping Right (finger moves right, translationX > 0) -> Previous Tab
      else if (e.translationX > threshold || e.velocityX > velocity) {
        if (currentIndex > 0) {
          const prevRoute = TAB_ROUTES[currentIndex - 1];
          runOnJS(navigateTo)(prevRoute);
        }
      }
    });

  return { panGesture, currentIndex };
}
