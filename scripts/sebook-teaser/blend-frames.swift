// Averages each frame's sub-frames into one motion-blurred frame — temporal
// supersampling, i.e. what a real camera's open shutter records — and lays a
// fixed film grain over it.
//
//   swift -O blend-frames.swift <sub-frames-dir> <samples> <grain> <frames-dir>
//
// Reads sub-00000-0.png … sub-00000-<samples-1>.png per frame and writes
// frame-00000.png (the per-channel mean) into <frames-dir>. <grain> is the
// grain's amplitude in 8-bit levels (0 = none); the same seeded noise is used
// for every frame, so it reads as film texture, breaks up gradient banding,
// and costs the video encoder almost nothing between keyframes. Frames blend
// in parallel; every frame needs exactly <samples> sub-frames of equal size.
import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("blend-frames: \(message)\n".utf8))
    exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count == 5, let samples = Int(arguments[2]), samples > 0, let grain = Double(arguments[3]), grain >= 0 else {
    fail("usage: swift -O blend-frames.swift <sub-frames-dir> <samples> <grain> <frames-dir>")
}
let subDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let outDirectory = URL(fileURLWithPath: arguments[4], isDirectory: true)

// Group sub-frame files by frame index.
let pattern = try! NSRegularExpression(pattern: #"^sub-(\d+)-(\d+)\.png$"#)
var groups: [Int: [Int: URL]] = [:]
for name in (try? FileManager.default.contentsOfDirectory(atPath: subDirectory.path)) ?? [] {
    let range = NSRange(name.startIndex..., in: name)
    guard let match = pattern.firstMatch(in: name, range: range),
          let frame = Int(name[Range(match.range(at: 1), in: name)!]),
          let sample = Int(name[Range(match.range(at: 2), in: name)!]) else { continue }
    groups[frame, default: [:]][sample] = subDirectory.appendingPathComponent(name)
}
let frames = groups.keys.sorted()
guard !frames.isEmpty else { fail("no sub-frames in \(subDirectory.path)") }
guard frames == Array(0..<frames.count) else { fail("frame indices are not contiguous from 0") }
for frame in frames where groups[frame]!.count != samples {
    fail("frame \(frame) has \(groups[frame]!.count) sub-frames, expected \(samples)")
}

@Sendable func loadImage(_ url: URL) -> CGImage {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fail("cannot read \(url.path)") }
    return image
}

let probe = loadImage(groups[0]![0]!)
let width = probe.width
let height = probe.height
let byteCount = width * height * 4
guard let sRGB = CGColorSpace(name: CGColorSpace.sRGB) else { fail("sRGB color space unavailable") }

// Monochrome grain, triangular-distributed, from a fixed seed (xorshift32).
var grainState: UInt32 = 0x5EB00C
func nextUnit() -> Double {
    grainState ^= grainState << 13
    grainState ^= grainState >> 17
    grainState ^= grainState << 5
    return Double(grainState) / Double(UInt32.max)
}
let grainOffsets: [Int32] = (0..<(width * height)).map { _ in Int32(((nextUnit() + nextUnit() - 1) * grain).rounded()) }

func blend(frame: Int) {
    var sum = [UInt32](repeating: 0, count: byteCount)
    var pixels = [UInt8](repeating: 0, count: byteCount)
    for sample in 0..<samples {
        let image = loadImage(groups[frame]![sample]!)
        guard image.width == width, image.height == height else { fail("frame \(frame) sample \(sample) has the wrong size") }
        pixels.withUnsafeMutableBytes { buffer in
            let context = CGContext(
                data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
                space: sRGB, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
            context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
        }
        for i in 0..<byteCount { sum[i] &+= UInt32(pixels[i]) }
    }
    let half = UInt32(samples / 2)
    for pixel in 0..<(width * height) {
        let offset = grainOffsets[pixel]
        for channel in 0..<3 {
            let i = pixel * 4 + channel
            let mean = Int32((sum[i] + half) / UInt32(samples))
            pixels[i] = UInt8(clamping: mean + offset)
        }
        pixels[pixel * 4 + 3] = 255
    }

    let data = Data(pixels) as CFData
    guard let provider = CGDataProvider(data: data),
          let blended = CGImage(
            width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: width * 4,
            space: sRGB, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
            provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent) else {
        fail("cannot build frame \(frame)")
    }
    let url = outDirectory.appendingPathComponent(String(format: "frame-%05d.png", frame))
    guard let destination = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil) else {
        fail("cannot write \(url.path)")
    }
    CGImageDestinationAddImage(destination, blended, nil)
    guard CGImageDestinationFinalize(destination) else { fail("cannot write \(url.path)") }
}

DispatchQueue.concurrentPerform(iterations: frames.count) { blend(frame: $0) }
print("blend-frames: \(frames.count) frames × \(samples) sub-frames, grain ±\(grain) → \(outDirectory.path)")
