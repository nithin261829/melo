import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { getPlaylist } from '../../lib/yt';
import CollectionView from '../../ui/CollectionView';

export default function Playlist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => getPlaylist(id), [id]);
  return <CollectionView load={load} />;
}
