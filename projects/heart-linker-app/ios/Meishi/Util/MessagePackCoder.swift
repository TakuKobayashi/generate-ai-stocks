import Foundation

// MARK: - MessagePack 軽量実装 (外部ライブラリ不要)
// 使用する型: Map / Array / String / Binary / Int / Nil のみ

// MARK: Packer

struct MsgPackPacker {
    private var buf = Data()

    // --- Public pack API ---

    mutating func packNil()                 { buf.append(0xc0) }
    mutating func packBool(_ v: Bool)       { buf.append(v ? 0xc3 : 0xc2) }

    mutating func packInt(_ v: Int)         { packInt64(Int64(v)) }
    mutating func packInt64(_ v: Int64) {
        if v >= 0 && v <= 127 {
            buf.append(UInt8(v))
        } else if v >= -32 && v < 0 {
            buf.append(UInt8(bitPattern: Int8(v)))
        } else if v >= 0 && v <= 0xFF {
            buf.append(contentsOf: [0xcc, UInt8(v)])
        } else if v >= 0 && v <= 0xFFFF {
            buf.append(0xcd); packBE16(UInt16(v))
        } else if v >= 0 && v <= 0xFFFF_FFFF {
            buf.append(0xce); packBE32(UInt32(v))
        } else if v >= 0 {
            buf.append(0xcf); packBE64(UInt64(v))
        } else if v >= Int64(Int8.min) {
            buf.append(contentsOf: [0xd0, UInt8(bitPattern: Int8(v))])
        } else if v >= Int64(Int16.min) {
            buf.append(0xd1); packBE16(UInt16(bitPattern: Int16(v)))
        } else if v >= Int64(Int32.min) {
            buf.append(0xd2); packBE32(UInt32(bitPattern: Int32(v)))
        } else {
            buf.append(0xd3); packBE64(UInt64(bitPattern: v))
        }
    }

    mutating func packString(_ s: String) {
        let utf8 = Array(s.utf8)
        let len = utf8.count
        if len <= 31 {
            buf.append(0xa0 | UInt8(len))
        } else if len <= 0xFF {
            buf.append(contentsOf: [0xd9, UInt8(len)])
        } else if len <= 0xFFFF {
            buf.append(0xda); packBE16(UInt16(len))
        } else {
            buf.append(0xdb); packBE32(UInt32(len))
        }
        buf.append(contentsOf: utf8)
    }

    mutating func packBinary(_ d: Data) {
        let len = d.count
        if len <= 0xFF {
            buf.append(contentsOf: [0xc4, UInt8(len)])
        } else if len <= 0xFFFF {
            buf.append(0xc5); packBE16(UInt16(len))
        } else {
            buf.append(0xc6); packBE32(UInt32(len))
        }
        buf.append(d)
    }

    mutating func packMapHeader(_ n: Int) {
        if n <= 15 {
            buf.append(0x80 | UInt8(n))
        } else if n <= 0xFFFF {
            buf.append(0xde); packBE16(UInt16(n))
        } else {
            buf.append(0xdf); packBE32(UInt32(n))
        }
    }

    mutating func packArrayHeader(_ n: Int) {
        if n <= 15 {
            buf.append(0x90 | UInt8(n))
        } else if n <= 0xFFFF {
            buf.append(0xdc); packBE16(UInt16(n))
        } else {
            buf.append(0xdd); packBE32(UInt32(n))
        }
    }

    func bytes() -> Data { buf }

    // --- Private helpers ---
    private mutating func packBE16(_ v: UInt16) { buf.append(contentsOf: [UInt8(v >> 8), UInt8(v & 0xFF)]) }
    private mutating func packBE32(_ v: UInt32) {
        buf.append(contentsOf: [UInt8(v >> 24), UInt8((v >> 16) & 0xFF), UInt8((v >> 8) & 0xFF), UInt8(v & 0xFF)])
    }
    private mutating func packBE64(_ v: UInt64) {
        (0..<8).reversed().forEach { buf.append(UInt8((v >> ($0 * 8)) & 0xFF)) }
    }
}

// MARK: Unpacker

struct MsgPackUnpacker {
    private let data: Data
    private var pos: Int = 0

    init(_ data: Data) { self.data = data }

    // --- Public unpack API ---

    mutating func unpackNil() -> Bool {
        guard peek() == 0xc0 else { return false }
        pos += 1; return true
    }

    mutating func unpackInt() -> Int { Int(unpackInt64()) }
    mutating func unpackInt64() -> Int64 {
        let b = next()
        switch b {
        case 0x00...0x7f: return Int64(b)
        case 0xe0...0xff: return Int64(Int8(bitPattern: b))
        case 0xcc: return Int64(next())
        case 0xcd: return Int64(readBE16())
        case 0xce: return Int64(readBE32())
        case 0xcf: return Int64(bitPattern: readBE64())
        case 0xd0: return Int64(Int8(bitPattern: next()))
        case 0xd1: return Int64(Int16(bitPattern: readBE16()))
        case 0xd2: return Int64(Int32(bitPattern: readBE32()))
        case 0xd3: return Int64(bitPattern: readBE64())
        default:   return 0
        }
    }

    mutating func unpackString() -> String {
        let b = next()
        let len: Int
        switch b {
        case 0xa0...0xbf: len = Int(b & 0x1f)
        case 0xd9: len = Int(next())
        case 0xda: len = Int(readBE16())
        case 0xdb: len = Int(readBE32())
        default: return ""
        }
        let slice = data[pos..<pos+len]; pos += len
        return String(bytes: slice, encoding: .utf8) ?? ""
    }

    mutating func unpackBinary() -> Data {
        let b = next()
        let len: Int
        switch b {
        case 0xc4: len = Int(next())
        case 0xc5: len = Int(readBE16())
        case 0xc6: len = Int(readBE32())
        default: return Data()
        }
        let slice = data[pos..<pos+len]; pos += len
        return Data(slice)
    }

    mutating func unpackMapHeader() -> Int {
        let b = next()
        switch b {
        case 0x80...0x8f: return Int(b & 0x0f)
        case 0xde: return Int(readBE16())
        case 0xdf: return Int(readBE32())
        default: return 0
        }
    }

    mutating func unpackArrayHeader() -> Int {
        let b = next()
        switch b {
        case 0x90...0x9f: return Int(b & 0x0f)
        case 0xdc: return Int(readBE16())
        case 0xdd: return Int(readBE32())
        default: return 0
        }
    }

    mutating func skipValue() {
        let b = next()
        switch b {
        case 0xc0, 0xc2, 0xc3: break
        case 0x00...0x7f, 0xe0...0xff: break
        case 0xcc, 0xd0: pos += 1
        case 0xcd, 0xd1: pos += 2
        case 0xce, 0xd2: pos += 4
        case 0xcf, 0xd3: pos += 8
        case 0xa0...0xbf: pos += Int(b & 0x1f)
        case 0xd9: pos += Int(next())
        case 0xda: pos += Int(readBE16())
        case 0xdb: pos += Int(readBE32())
        case 0xc4: pos += Int(next())
        case 0xc5: pos += Int(readBE16())
        case 0xc6: pos += Int(readBE32())
        case 0x80...0x8f:
            let n = Int(b & 0x0f); (0..<n*2).forEach { _ in skipValue() }
        case 0xde:
            let n = Int(readBE16()); (0..<n*2).forEach { _ in skipValue() }
        case 0x90...0x9f:
            let n = Int(b & 0x0f); (0..<n).forEach { _ in skipValue() }
        case 0xdc:
            let n = Int(readBE16()); (0..<n).forEach { _ in skipValue() }
        default: break
        }
    }

    // --- Private helpers ---
    private func peek() -> UInt8 { pos < data.count ? data[pos] : 0 }
    private mutating func next() -> UInt8 {
        guard pos < data.count else { return 0 }
        let b = data[pos]; pos += 1; return b
    }
    private mutating func readBE16() -> UInt16 { (UInt16(next()) << 8) | UInt16(next()) }
    private mutating func readBE32() -> UInt32 { (0..<4).reduce(UInt32(0)) { ($0 << 8) | UInt32(next()) } }
    private mutating func readBE64() -> UInt64 { (0..<8).reduce(UInt64(0)) { ($0 << 8) | UInt64(next()) } }
}
