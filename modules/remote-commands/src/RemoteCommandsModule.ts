import { NativeModule, requireNativeModule } from 'expo';
import { Platform } from 'react-native';

type Events = { onRemoteTrack(e: { command: 'next' | 'previous' }): void };

declare class RemoteCommandsModule extends NativeModule<Events> {
  /** Shows next/previous track (instead of ±10 s) on the lock screen and Dynamic Island. */
  showTrackButtons(): void;
}

export default Platform.OS === 'ios' ? requireNativeModule<RemoteCommandsModule>('RemoteCommands') : null;
