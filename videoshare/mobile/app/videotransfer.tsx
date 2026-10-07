import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoTransferScreen } from '../src/screens/VideoTransferScreen';
import { toRoutePath } from '../src/utils/routeMap';

export default function VideoTransfer() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const route = { params };
  const navigation = {
    navigate: (name: string, p?: any) => router.push({ pathname: toRoutePath(name) as any, params: p }),
    replace: (name: string, p?: any) => router.replace({ pathname: toRoutePath(name) as any, params: p }),
    goBack: () => router.back(),
  };
  return <VideoTransferScreen route={route} navigation={navigation} />;
}
