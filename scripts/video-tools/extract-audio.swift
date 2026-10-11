// Copy an existing AAC soundtrack into an audio-only M4A without re-encoding.
//   swift extract-audio.swift <input.mp4> <output.m4a>
import AVFoundation
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("extract-audio: \(message)\n".utf8))
    exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count == 3 else {
    fail("usage: swift extract-audio.swift <input.mp4> <output.m4a>")
}
let sourceURL = URL(fileURLWithPath: arguments[1])
let outputURL = URL(fileURLWithPath: arguments[2])
guard sourceURL.standardizedFileURL != outputURL.standardizedFileURL else {
    fail("input and output must be different files")
}

Task {
    do {
        let source = AVURLAsset(url: sourceURL)
        guard let track = try await source.loadTracks(withMediaType: .audio).first else {
            fail("no audio track in \(sourceURL.path)")
        }
        let timeRange = try await track.load(.timeRange)
        let composition = AVMutableComposition()
        guard let audio = composition.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) else {
            fail("cannot create an audio-only composition")
        }
        try audio.insertTimeRange(timeRange, of: track, at: timeRange.start)
        guard let export = AVAssetExportSession(asset: composition, presetName: AVAssetExportPresetPassthrough) else {
            fail("cannot create a passthrough export")
        }
        if FileManager.default.fileExists(atPath: outputURL.path) {
            try FileManager.default.removeItem(at: outputURL)
        }
        try await export.export(to: outputURL, as: .m4a)
        let duration = try await AVURLAsset(url: outputURL).load(.duration)
        print("Copied AAC audio without re-encoding: \(duration.seconds) s, \(outputURL.path)")
        exit(0)
    } catch {
        fail(String(describing: error))
    }
}
dispatchMain()
