// Encodes numbered PNG frames (plus an optional WAV soundtrack) into an MP4
// with macOS AVFoundation — H.264 video, AAC audio — so rendering the SE Book
// teaser needs no ffmpeg install.
//
//   swift encode-mp4.swift <frames-dir> <fps> <video-bits-per-second> <output.mp4> [<soundtrack.wav>]
//
// Frames are read in file-name order (frame-00000.png, …) and must all share
// the first frame's size. The MP4 is tagged BT.709, lasts exactly
// frameCount / fps seconds (longer audio is cut there), and keeps its index at
// the front ("fast start") so browsers can play before it has fully loaded.
import AVFoundation
import CoreGraphics
import Foundation
import ImageIO

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("encode-mp4: \(message)\n".utf8))
    exit(1)
}

func loadImage(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        fail("cannot read \(url.path)")
    }
    return image
}

func firstAudioTrack(of asset: AVURLAsset) -> AVAssetTrack {
    let loaded = DispatchSemaphore(value: 0)
    final class Box: @unchecked Sendable { var track: AVAssetTrack? }
    let box = Box()
    Task {
        box.track = try? await asset.loadTracks(withMediaType: .audio).first
        loaded.signal()
    }
    loaded.wait()
    guard let track = box.track else { fail("no audio track in \(asset.url.path)") }
    return track
}

/** Feeds one writer input from `next()` whenever AVFoundation asks for more. */
final class Feed: @unchecked Sendable {
    private let input: AVAssetWriterInput
    private let next: () -> Bool
    private var finished = false

    init(_ input: AVAssetWriterInput, next: @escaping () -> Bool) {
        self.input = input
        self.next = next
    }

    func start(_ label: String, group: DispatchGroup) {
        group.enter()
        input.requestMediaDataWhenReady(on: DispatchQueue(label: label)) {
            while !self.finished && self.input.isReadyForMoreMediaData {
                if !self.next() {
                    self.finished = true
                    self.input.markAsFinished()
                    group.leave()
                }
            }
        }
    }
}

let arguments = CommandLine.arguments
guard arguments.count == 5 || arguments.count == 6,
      let fps = Int32(arguments[2]), fps > 0,
      let bitsPerSecond = Int(arguments[3]) else {
    fail("usage: swift encode-mp4.swift <frames-dir> <fps> <video-bits-per-second> <output.mp4> [<soundtrack.wav>]")
}
let framesDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let outputURL = URL(fileURLWithPath: arguments[4])
let soundtrackURL = arguments.count == 6 ? URL(fileURLWithPath: arguments[5]) : nil

let frameURLs = ((try? FileManager.default.contentsOfDirectory(at: framesDirectory, includingPropertiesForKeys: nil)) ?? [])
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard !frameURLs.isEmpty else { fail("no PNG frames in \(framesDirectory.path)") }

let firstFrame = loadImage(frameURLs[0])
let width = firstFrame.width
let height = firstFrame.height

try? FileManager.default.removeItem(at: outputURL)
let writer: AVAssetWriter
do {
    writer = try AVAssetWriter(outputURL: outputURL, fileType: .mp4)
} catch {
    fail("cannot create \(outputURL.path): \(error)")
}
writer.shouldOptimizeForNetworkUse = true

// Video: H.264 High profile from BGRA pixel buffers.
let videoInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoColorPropertiesKey: [
        AVVideoColorPrimariesKey: AVVideoColorPrimaries_ITU_R_709_2,
        AVVideoTransferFunctionKey: AVVideoTransferFunction_ITU_R_709_2,
        AVVideoYCbCrMatrixKey: AVVideoYCbCrMatrix_ITU_R_709_2,
    ],
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: bitsPerSecond,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
        AVVideoH264EntropyModeKey: AVVideoH264EntropyModeCABAC,
        AVVideoExpectedSourceFrameRateKey: Int(fps),
        AVVideoMaxKeyFrameIntervalKey: Int(fps) * 2,
        AVVideoAllowFrameReorderingKey: true,
    ],
])
videoInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: videoInput, sourcePixelBufferAttributes: [
    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
])
guard writer.canAdd(videoInput) else { fail("the writer rejected the H.264 output settings") }
writer.add(videoInput)

// Audio (optional): the WAV is decoded to 16-bit PCM and re-encoded as AAC.
var audioInput: AVAssetWriterInput?
var audioOutput: AVAssetReaderTrackOutput?
var audioReader: AVAssetReader?
if let soundtrackURL {
    let asset = AVURLAsset(url: soundtrackURL)
    do {
        audioReader = try AVAssetReader(asset: asset)
    } catch {
        fail("cannot read \(soundtrackURL.path): \(error)")
    }
    let output = AVAssetReaderTrackOutput(track: firstAudioTrack(of: asset), outputSettings: [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
        AVLinearPCMIsNonInterleaved: false,
    ])
    audioReader?.add(output)
    var stereo = AudioChannelLayout()
    stereo.mChannelLayoutTag = kAudioChannelLayoutTag_Stereo
    let input = AVAssetWriterInput(mediaType: .audio, outputSettings: [
        AVFormatIDKey: kAudioFormatMPEG4AAC,
        AVNumberOfChannelsKey: 2,
        AVSampleRateKey: 48000,
        AVEncoderBitRateKey: 160_000,
        AVChannelLayoutKey: Data(bytes: &stereo, count: MemoryLayout<AudioChannelLayout>.size),
    ])
    input.expectsMediaDataInRealTime = false
    guard writer.canAdd(input) else { fail("the writer rejected the AAC output settings") }
    writer.add(input)
    audioInput = input
    audioOutput = output
}

guard writer.startWriting() else { fail("cannot start writing: \(String(describing: writer.error))") }
writer.startSession(atSourceTime: .zero)
if let audioReader, !audioReader.startReading() {
    fail("cannot decode the soundtrack: \(String(describing: audioReader.error))")
}

guard let sRGB = CGColorSpace(name: CGColorSpace.sRGB) else { fail("sRGB color space unavailable") }
final class Counter: @unchecked Sendable { var value = 0 }
let nextFrame = Counter()

let group = DispatchGroup()
Feed(videoInput) {
    let index = nextFrame.value
    guard index < frameURLs.count else { return false }
    let image = index == 0 ? firstFrame : loadImage(frameURLs[index])
    guard image.width == width, image.height == height else {
        fail("\(frameURLs[index].lastPathComponent) is \(image.width)×\(image.height), expected \(width)×\(height)")
    }
    guard let pool = adaptor.pixelBufferPool else { fail("no pixel buffer pool: \(String(describing: writer.error))") }
    var pixelBuffer: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, pool, &pixelBuffer)
    guard let buffer = pixelBuffer else { fail("cannot allocate a pixel buffer for frame \(index)") }
    CVPixelBufferLockBaseAddress(buffer, [])
    let context = CGContext(
        data: CVPixelBufferGetBaseAddress(buffer),
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
        space: sRGB,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    )
    context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(buffer, [])
    guard adaptor.append(buffer, withPresentationTime: CMTime(value: CMTimeValue(index), timescale: fps)) else {
        fail("cannot append frame \(index): \(String(describing: writer.error))")
    }
    nextFrame.value += 1
    return true
}.start("video", group: group)

if let audioInput, let audioOutput {
    Feed(audioInput) {
        guard let sample = audioOutput.copyNextSampleBuffer() else { return false }
        guard audioInput.append(sample) else { fail("cannot append audio: \(String(describing: writer.error))") }
        return true
    }.start("audio", group: group)
}
group.wait()

writer.endSession(atSourceTime: CMTime(value: CMTimeValue(frameURLs.count), timescale: fps))
let finished = DispatchSemaphore(value: 0)
writer.finishWriting { finished.signal() }
finished.wait()
guard writer.status == .completed else { fail("encoding failed: \(String(describing: writer.error))") }

// The fast-start pass leaves the pre-rewrite file behind as "<name>.sb-<id>".
let outputDirectory = outputURL.deletingLastPathComponent()
let scratchPrefix = outputURL.lastPathComponent + ".sb-"
for leftover in (try? FileManager.default.contentsOfDirectory(atPath: outputDirectory.path)) ?? []
    where leftover.hasPrefix(scratchPrefix) {
    try? FileManager.default.removeItem(at: outputDirectory.appendingPathComponent(leftover))
}
let audioNote = soundtrackURL == nil ? "no audio" : "AAC audio"
print("encode-mp4: \(frameURLs.count) frames, \(width)×\(height) @ \(fps) fps, \(audioNote) → \(outputURL.path)")
