import { getHistory } from '../lib/yt';
import CollectionView from '../ui/CollectionView';

export default function History() {
  return <CollectionView load={getHistory} />;
}
