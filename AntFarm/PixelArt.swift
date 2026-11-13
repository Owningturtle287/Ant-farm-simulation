import UIKit
import SpriteKit

enum Palette {
    static let ink = UIColor(hex:0x101E1C)
    static let moss = UIColor(hex:0xA5C986)
    static let amber = UIColor(hex:0xEBC381)
    static let cream = UIColor(hex:0xEEE8D5)
}
extension UIColor {
    convenience init(hex: UInt32, alpha: CGFloat = 1) {
        self.init(red:CGFloat((hex >> 16)&255)/255,green:CGFloat((hex >> 8)&255)/255,blue:CGFloat(hex&255)/255,alpha:alpha)
    }
}

@MainActor
enum PixelArt {
    static func texture(width: Int,height: Int,draw: (CGContext) -> Void) -> SKTexture {
        let format = UIGraphicsImageRendererFormat(); format.scale = 1; format.opaque = false
        let image = UIGraphicsImageRenderer(size:CGSize(width:width,height:height),format:format).image { context in
            context.cgContext.setShouldAntialias(false); draw(context.cgContext)
        }
        let texture = SKTexture(image:image); texture.filteringMode = .nearest
        return texture
    }

    static func ant(_ caste: Caste, frame: Int) -> SKTexture {
        texture(width:32,height:18) { c in
            func box(_ x: Int,_ y: Int,_ w: Int,_ h: Int,_ color: UInt32) {
                c.setFillColor(UIColor(hex:color).cgColor); c.fill(CGRect(x:x,y:y,width:w,height:h))
            }
            let body: UInt32 = caste == .queen ? 0xA64E3D : caste == .soldier ? 0x663D31 : 0x8F4D32
            let light: UInt32 = caste == .queen ? 0xD17951 : 0xBE7950
            for leg in 0..<3 {
                let x = 13+leg*3, swing = (frame+leg)%2 == 0 ? 1 : -1
                box(x,3,1,4,0x3E2A26); box(x+swing,1,3,1,0x3E2A26)
                box(x,10,1,4,0x3E2A26); box(x-swing,14,3,1,0x3E2A26)
            }
            box(2,6,10,6,0x382B27); box(4,4,7,9,body); box(3,6,9,5,body)
            box(5,5,5,2,light); box(6,11,5,1,0x57332A)
            box(11,8,4,2,0x382B27); box(14,6,6,6,body); box(15,6,4,2,light)
            box(20,7,3,3,0x382B27); box(22,5,7,7,body); box(23,5,5,2,light)
            if caste == .soldier { box(23,3,6,3,body); box(29,6,3,1,0xDBAD73); box(29,10,3,1,0xDBAD73) }
            box(27,6,1,1,0xFBE4AD)
            box(27,3,1,3,0x3E2A26); box(28,2,3,1,0x3E2A26)
            box(27,11,1,3,0x3E2A26); box(28,14,3,1,0x3E2A26)
        }
    }

    static func tree(variant: Int) -> SKTexture {
        texture(width:96,height:116) { c in
            func box(_ x: Int,_ y: Int,_ w: Int,_ h: Int,_ color: UInt32) {
                c.setFillColor(UIColor(hex:color).cgColor); c.fill(CGRect(x:x,y:y,width:w,height:h))
            }
            box(45,54,9,62,0x4A4132); box(47,58,3,55,0x766044)
            box(35,72,13,5,0x4A4132); box(33,62,5,14,0x4A4132)
            box(53,62,16,5,0x4A4132); box(64,51,5,14,0x4A4132)
            let colors: [UInt32] = [0x284D42,0x35644B,0x4C7B53,0x71935D]
            for i in 0..<29 {
                let x = 8+(i*19+variant*7)%65, y = 12+(i*13)%53
                box(x,y,18+(i%3)*5,13+(i%4)*3,colors[i%4])
            }
            for i in 0..<12 { box(20+(i*17)%60,20+(i*11)%35,5,3,0x93AA6D) }
        }
    }
}
