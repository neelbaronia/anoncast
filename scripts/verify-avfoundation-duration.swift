#!/usr/bin/env swift

import AVFoundation
import Foundation

func fail(_ message: String, code: Int32 = 1) -> Never {
    FileHandle.standardError.write(Data("\(message)\n".utf8))
    exit(code)
}

guard CommandLine.arguments.count >= 2 else {
    fail("Usage: swift scripts/verify-avfoundation-duration.swift <audio-file> [expected-seconds] [tolerance-seconds]")
}

let audioPath = CommandLine.arguments[1]
let expected = CommandLine.arguments.count >= 3 ? Double(CommandLine.arguments[2]) : nil
let tolerance = CommandLine.arguments.count >= 4 ? Double(CommandLine.arguments[3]) ?? 0.25 : 0.25
let asset = AVURLAsset(url: URL(fileURLWithPath: audioPath))

Task {
    do {
        let duration = try await asset.load(.duration)
        let seconds = CMTimeGetSeconds(duration)
        guard seconds.isFinite && seconds > 0 else {
            fail("AVFoundation returned an invalid duration: \(seconds)")
        }

        if let expected, abs(seconds - expected) > tolerance {
            fail(
                "AVFoundation duration \(seconds)s differs from expected \(expected)s by more than \(tolerance)s",
                code: 2
            )
        }

        print(String(format: "%.6f", seconds))
        exit(0)
    } catch {
        fail("AVFoundation could not load duration: \(error)")
    }
}

dispatchMain()
