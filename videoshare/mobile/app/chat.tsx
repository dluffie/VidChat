import { useRouter } from 'expo-router';
import { ChatScreen } from '../src/screens/ChatScreen';
import { toRoutePath } from '../src/utils/routeMap';

export default function Chat() {
  const router = useRouter();
  const navigation = {
    navigate: (name: string, params?: any) => router.push({ pathname: toRoutePath(name) as any, params }),
    replace: (name: string, params?: any) => router.replace({ pathname: toRoutePath(name) as any, params }),
    goBack: () => router.back(),
  };
  return <ChatScreen navigation={navigation} />;
}
