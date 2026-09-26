// Screens rendered teaser frames against WCAG 2.3.1 (Three Flashes or Below
// Threshold) before render.js encodes them.
//
//   swift -O check-flashes.swift <frames-dir> <fps>
//
// A conservative reading of the WCAG general-flash and red-flash definitions:
//   - frames are reduced to a 480×270 grid (one cell per 4×4 frame pixels);
//   - a transition is a swing in relative luminance of at least 0.10 away
//     from the last extreme with the darker side below 0.80, or a cell
//     entering or leaving saturated red (R ≥ 80% of R+G+B);
//   - a cell flashes when it makes more than six transitions (three flashes)
//     within any one second;
//   - the video fails if flashing cells cover more than 25% of any 10° visual
//     field, taken as a 640×480 region of the 1920×1080 frame — the worst
//     case of the video filling a 1024-pixel-wide screen.
// Moving high-contrast detail (scrolling or shaking text) registers as
// transitions too, which keeps the screen on the safe side.
// Exit status: 0 = passes, 1 = fails, 2 = usage or I/O error.
import CoreGraphics
import Foundation
import ImageIO

func fail(_ message: String, status: Int32 = 2) -> Never {
    FileHandle.standardError.write(Data("check-flashes: \(message)\n".utf8))
    exit(status)
}

let arguments = CommandLine.arguments
guard arguments.count == 3, let fps = Int(arguments[2]), fps > 0 else {
    fail("usage: swift -O check-flashes.swift <frames-dir> <fps>")
}
let framesDirectory = URL(fileURLWithPath: arguments[1], isDirectory: true)
let frameURLs = ((try? FileManager.default.contentsOfDirectory(at: framesDirectory, includingPropertiesForKeys: nil)) ?? [])
    .filter { $0.pathExtension.lowercased() == "png" }
    .sorted { $0.lastPathComponent < $1.lastPathComponent }
guard frameURLs.count > fps else { fail("need more than \(fps) PNG frames in \(framesDirectory.path)") }

let width = 480, height = 270, cells = width * height
let fieldWidth = 160, fieldHeight = 120 // 640×480 frame pixels
let maxTransitionsPerSecond = 6
let linear: [Float] = (0..<256).map { value in
    let c = Float(value) / 255
    return c <= 0.04045 ? c / 12.92 : powf((c + 0.055) / 1.055, 2.4)
}

/** Decodes a frame onto the analysis grid as 8-bit RGBA. */
func loadGrid(_ url: URL) -> [UInt8] {
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fail("cannot read \(url.path)") }
    var pixels = [UInt8](repeating: 0, count: cells * 4)
    pixels.withUnsafeMutableBytes { buffer in
        let context = CGContext(
            data: buffer.baseAddress, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4,
            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)
        context?.interpolationQuality = .medium
        context?.draw(image, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    return pixels
}

// Per-cell flash state.
var reference = [Float](repeating: 0, count: cells) // last extreme (or running min/max before the first swing)
var low = [Float](repeating: 0, count: cells)
var high = [Float](repeating: 0, count: cells)
var direction = [Int8](repeating: 0, count: cells) // +1 rising, -1 falling, 0 undecided
var wasRed = [Bool](repeating: false, count: cells)
// Transitions in the last `fps` frames, kept as a ring of per-frame maps.
var history = [[UInt8]](repeating: [UInt8](repeating: 0, count: cells), count: fps)
var windowCount = [Int](repeating: 0, count: cells)

var worstShare = 0.0
var worstTime = 0.0
for (frame, url) in frameURLs.enumerated() {
    let pixels = loadGrid(url)
    var transitions = [UInt8](repeating: 0, count: cells)
    for cell in 0..<cells {
        let r = Int(pixels[cell * 4]), g = Int(pixels[cell * 4 + 1]), b = Int(pixels[cell * 4 + 2])
        let luminance = 0.2126 * linear[r] + 0.7152 * linear[g] + 0.0722 * linear[b]
        let red = r > 60 && r * 5 >= (r + g + b) * 4
        if frame == 0 {
            reference[cell] = luminance; low[cell] = luminance; high[cell] = luminance; wasRed[cell] = red
            continue
        }
        var swung = false
        switch direction[cell] {
        case 1: // rising: track the peak, look for a drop
            reference[cell] = max(reference[cell], luminance)
            if reference[cell] - luminance >= 0.1 && luminance < 0.8 { direction[cell] = -1; swung = true }
        case -1: // falling: track the trough, look for a rise
            reference[cell] = min(reference[cell], luminance)
            if luminance - reference[cell] >= 0.1 && reference[cell] < 0.8 { direction[cell] = 1; swung = true }
        default:
            low[cell] = min(low[cell], luminance)
            high[cell] = max(high[cell], luminance)
            if luminance - low[cell] >= 0.1 && low[cell] < 0.8 { direction[cell] = 1; swung = true }
            else if high[cell] - luminance >= 0.1 && luminance < 0.8 { direction[cell] = -1; swung = true }
        }
        if swung { reference[cell] = luminance }
        if red != wasRed[cell] { swung = true; wasRed[cell] = red }
        transitions[cell] = swung ? 1 : 0
    }

    let slot = frame % fps
    for cell in 0..<cells {
        windowCount[cell] += Int(transitions[cell]) - Int(history[slot][cell])
    }
    history[slot] = transitions
    guard frame >= fps else { continue }

    // Share of the busiest 10° field whose cells flash more than three times a second.
    var integral = [Int32](repeating: 0, count: (width + 1) * (height + 1))
    var anyFlashing = false
    for y in 0..<height {
        var rowSum: Int32 = 0
        for x in 0..<width {
            let flashing: Int32 = windowCount[y * width + x] > maxTransitionsPerSecond ? 1 : 0
            if flashing == 1 { anyFlashing = true }
            rowSum += flashing
            integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1] + rowSum
        }
    }
    guard anyFlashing else { continue }
    var busiest: Int32 = 0
    for y in 0...(height - fieldHeight) {
        for x in 0...(width - fieldWidth) {
            let top = y * (width + 1), bottom = (y + fieldHeight) * (width + 1)
            let sum = integral[bottom + x + fieldWidth] - integral[top + x + fieldWidth] - integral[bottom + x] + integral[top + x]
            busiest = max(busiest, sum)
        }
    }
    let share = Double(busiest) / Double(fieldWidth * fieldHeight)
    if share > worstShare {
        worstShare = share
        worstTime = Double(frame + 1 - fps) / Double(fps)
    }
}

let verdict = worstShare > 0.25 ? "FAILS" : "passes"
print(String(format: "check-flashes: WCAG 2.3.1 %@ — busiest 10° field flashing: %.1f%% (limit 25%%)%@",
             verdict, worstShare * 100, worstShare > 0 ? String(format: ", 1-second window from %.2f s", worstTime) : ""))
exit(worstShare > 0.25 ? 1 : 0)
