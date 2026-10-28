import ExpoModulesCore
import MediaPlayer

// expo-audio's single-file player only offers ±10 s skip buttons on the lock screen and
// Dynamic Island. This swaps them for next/previous track and forwards the taps to JS,
// where Melo's own queue decides what plays.
public class RemoteCommandsModule: Module {
  private var targets: [(MPRemoteCommand, Any)] = []

  public func definition() -> ModuleDefinition {
    Name("RemoteCommands")

    Events("onRemoteTrack")

    // Call after every setActiveForLockScreen / updateLockScreenMetadata: expo-audio
    // re-registers its own commands each time.
    Function("showTrackButtons") {
      DispatchQueue.main.async { self.apply() }
    }
  }

  private func apply() {
    let center = MPRemoteCommandCenter.shared()
    center.skipForwardCommand.isEnabled = false
    center.skipBackwardCommand.isEnabled = false

    for (command, target) in targets {
      command.removeTarget(target)
    }
    targets.removeAll()
    // Drop expo-audio's next/previous handlers; they refuse the command for a plain player.
    center.nextTrackCommand.removeTarget(nil)
    center.previousTrackCommand.removeTarget(nil)

    let next = center.nextTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteTrack", ["command": "next"])
      return .success
    }
    let previous = center.previousTrackCommand.addTarget { [weak self] _ in
      self?.sendEvent("onRemoteTrack", ["command": "previous"])
      return .success
    }
    targets = [(center.nextTrackCommand, next), (center.previousTrackCommand, previous)]
    center.nextTrackCommand.isEnabled = true
    center.previousTrackCommand.isEnabled = true
  }
}
