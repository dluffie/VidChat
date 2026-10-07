import { useRouter } from 'expo-router';
import { HomeScreen } from '../src/screens/HomeScreen';
import { toRoutePath } from '../src/utils/routeMap';

export default function Home() {
  const router = useRouter();
  const navigation = {
    navigate: (name: string, params?: any) => router.push({ pathname: toRoutePath(name) as any, params }),
    replace: (name: string, params?: any) => router.replace({ pathname: toRoutePath(name) as any, params }),
    goBack: () => router.back(),
  };
  return <HomeScreen navigation={navigation} />;
}
