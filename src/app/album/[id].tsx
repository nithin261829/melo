import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { getAlbum } from '../../lib/yt';
import CollectionView from '../../ui/CollectionView';

export default function Album() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => getAlbum(id), [id]);
  return <CollectionView load={load} numbered />;
}
