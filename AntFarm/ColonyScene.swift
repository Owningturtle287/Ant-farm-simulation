import SpriteKit
import UIKit

@MainActor
final class ColonyScene: SKScene {
    weak var controller: GameController?
    let tile: CGFloat = 12
    private let worldCamera = SKCameraNode()
    private let terrainLayer = SKNode()
    private let antLayer = SKNode()
    private let resourceLayer = SKNode()
    private let trailLayer = SKNode()
    private let decorLayer = SKNode()
    private var chunks: [Cell: SKSpriteNode] = [:]
    private var antNodes: [Int: SKSpriteNode] = [:]
    private var carryNodes: [Int: SKSpriteNode] = [:]
    private var antTextures: [String: [SKTexture]] = [:]
    private var revision = -1
    private var lastTime: TimeInterval = 0
    private var sinceDetails: TimeInterval = 1
    private var lastTouch: CGPoint?
    private var touchOrigin: CGPoint?
    private var dragged = false
    private var ring = SKShapeNode(circleOfRadius:13)
    private var pinch: UIPinchGestureRecognizer?

    init(controller: GameController) {
        self.controller = controller
        super.init(size:CGSize(width:1000,height:500))
        scaleMode = .resizeFill; backgroundColor = UIColor(hex:0x241E1A)
        camera = worldCamera; addChild(worldCamera)
        addChild(decorLayer); addChild(terrainLayer); addChild(trailLayer); addChild(resourceLayer); addChild(antLayer)
        decorLayer.zPosition = -10; terrainLayer.zPosition = 0; trailLayer.zPosition = 1
        resourceLayer.zPosition = 2; antLayer.zPosition = 3
        for caste in [Caste.worker,.queen,.soldier] { antTextures[caste.rawValue] = (0..<4).map { PixelArt.ant(caste,frame:$0) } }
        ring.strokeColor = Palette.amber; ring.lineWidth = 1.4; ring.glowWidth = 1
        ring.fillColor = .clear; ring.zPosition = 4; ring.isHidden = true; addChild(ring)
        buildLandscape(); resetCamera()
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    override func didMove(to view: SKView) {
        view.isMultipleTouchEnabled = true
        let gesture = UIPinchGestureRecognizer(target:self,action:#selector(zoom(_:)))
        gesture.cancelsTouchesInView = true; view.addGestureRecognizer(gesture); pinch = gesture
    }
    override func willMove(from view: SKView) { if let pinch { view.removeGestureRecognizer(pinch) } }
    func resetCamera() { worldCamera.position = CGPoint(x:0,y:-100); worldCamera.setScale(1.05); controller?.following = false }
    func resetWorld() {
        chunks.values.forEach { $0.removeFromParent() }; chunks = [:]; revision = -1
        antNodes.values.forEach { $0.removeFromParent() }; antNodes = [:]
        carryNodes.values.forEach { $0.removeFromParent() }; carryNodes = [:]
    }
    func focus(on ant: Ant) { worldCamera.position = point(ant.position) }
    private func point(_ p: Position) -> CGPoint { CGPoint(x:p.x*Double(tile),y: -p.y*Double(tile)) }

    @objc private func zoom(_ gesture: UIPinchGestureRecognizer) {
        guard gesture.state == .changed else { return }
        worldCamera.setScale(max(0.45,min(2.4,worldCamera.xScale/gesture.scale)))
        gesture.scale = 1; controller?.following = false
    }

    override func update(_ currentTime: TimeInterval) {
        guard let controller else { return }
        let dt = lastTime == 0 ? 0 : min(0.1,currentTime-lastTime); lastTime = currentTime
        controller.advance(wallDelta:dt)
        let colony = controller.activeSimulation
        if controller.following, let id = controller.selectedID, let ant = colony.ants.first(where: { $0.id == id }) {
            let p = point(ant.position)
            worldCamera.position.x += (p.x-worldCamera.position.x)*0.09
            worldCamera.position.y += (p.y-worldCamera.position.y)*0.09
        }
        renderTerrain(colony.world)
        renderAnts(colony,clock:currentTime)
        sinceDetails += dt
        if sinceDetails > 0.35 { renderDetails(colony); sinceDetails = 0 }
    }

    private func buildLandscape() {
        let skyColors: [UInt32] = [0x91B6A3,0x94B9A8,0x9DC0AE,0xA4C5B2,0xB2CEB5,0xC0D2B6]
        for (i,color) in skyColors.enumerated() {
            let stripe = SKSpriteNode(color:UIColor(hex:color),size:CGSize(width:60000,height:55))
            stripe.position = CGPoint(x:0,y:275-CGFloat(i)*55); decorLayer.addChild(stripe)
        }
        let highSky = SKSpriteNode(color:UIColor(hex:0x91B6A3),size:CGSize(width:60000,height:4000))
        highSky.position = CGPoint(x:0,y:2300); decorLayer.addChild(highSky)
        for i in -12...12 {
            let hill = SKShapeNode(ellipseOf:CGSize(width:360+abs(i%3)*90,height:110+abs(i%4)*12))
            hill.fillColor = UIColor(hex:i%2 == 0 ? 0x789D85 : 0x86AA90); hill.strokeColor = .clear
            hill.position = CGPoint(x:i*250,y:-8); decorLayer.addChild(hill)
        }
        for i in -8...8 where i != 0 {
            let tree = SKSpriteNode(texture:PixelArt.tree(variant:abs(i)))
            tree.size = CGSize(width:120+abs(i%3)*15,height:145+abs(i%3)*20)
            tree.anchorPoint = CGPoint(x:0.5,y:0); tree.position = CGPoint(x:i*330-70,y:-6)
            decorLayer.addChild(tree)
        }
        for i in -25...25 {
            let x = i*47+abs(i*13)%23
            let plant = SKShapeNode()
            let path = CGMutablePath()
            path.move(to:CGPoint(x:x,y:-6)); path.addLine(to:CGPoint(x:x-4,y:9)); path.addLine(to:CGPoint(x:x+1,y:2))
            path.move(to:CGPoint(x:x,y:-6)); path.addLine(to:CGPoint(x:x+7,y:13))
            plant.path = path; plant.lineWidth = 2; plant.strokeColor = UIColor(hex:0x557B4B)
            decorLayer.addChild(plant)
            if i%4 == 0 {
                let flower = SKSpriteNode(color:UIColor(hex:0xE5C183),size:CGSize(width:5,height:4))
                flower.position = CGPoint(x:x+7,y:13); decorLayer.addChild(flower)
            }
        }
        for i in -6...6 {
            let cloud = SKNode(); cloud.position = CGPoint(x:i*250,y:140+abs(i%3)*27)
            for j in 0..<4 {
                let part = SKSpriteNode(color:UIColor(hex:0xE5E6CE,alpha:0.58),size:CGSize(width:31,height:10+j%2*7))
                part.position = CGPoint(x:j*18,y:j%2*4); cloud.addChild(part)
            }
            decorLayer.addChild(cloud)
        }
    }

    private func renderTerrain(_ world: World) {
        let halfWidth = size.width*worldCamera.xScale/2+200
        let halfHeight = size.height*worldCamera.yScale/2+150
        let minX = Int(floor((worldCamera.position.x-halfWidth)/(tile*16)))
        let maxX = Int(floor((worldCamera.position.x+halfWidth)/(tile*16)))
        let minY = Int(floor((-worldCamera.position.y-halfHeight)/(tile*16)))
        let maxY = Int(floor((-worldCamera.position.y+halfHeight)/(tile*16)))
        let changed = revision != world.terrainRevision
        var visible: Set<Cell> = []
        for cy in minY...maxY { for cx in minX...maxX {
            let key = Cell(cx,cy); visible.insert(key)
            if chunks[key] == nil || changed {
                let texture = terrainTexture(world,key:key)
                let node: SKSpriteNode
                if let old = chunks[key] { node = old; node.texture = texture }
                else {
                    node = SKSpriteNode(texture:texture)
                    node.size = CGSize(width:tile*16,height:tile*16)
                    node.position = CGPoint(x:(CGFloat(cx*16)+7.5)*tile,y:-(CGFloat(cy*16)+7.5)*tile)
                    terrainLayer.addChild(node); chunks[key] = node
                }
            }
        } }
        for key in Array(chunks.keys) where !visible.contains(key) { chunks.removeValue(forKey:key)?.removeFromParent() }
        revision = world.terrainRevision
    }

    private func terrainTexture(_ world: World, key: Cell) -> SKTexture {
        PixelArt.texture(width:128,height:128) { c in
            for ly in 0..<16 { for lx in 0..<16 {
                let cell = Cell(key.x*16+lx,key.y*16+ly)
                let x = lx*8, y = ly*8
                let hash = abs((cell.x &* 73856093) ^ (cell.y &* 19349663) ^ Int(world.seed%10000))
                func fill(_ px: Int,_ py: Int,_ w: Int,_ h: Int,_ color: UInt32) {
                    c.setFillColor(UIColor(hex:color).cgColor); c.fill(CGRect(x:px,y:py,width:w,height:h))
                }
                if world.isSolid(cell) {
                    let colors: [UInt32] = cell.y > 28 ? [0x544438,0x58483A,0x5D4A3D] : [0x74543A,0x7B593E,0x705038,0x805D42]
                    fill(x,y,8,8,colors[hash%colors.count])
                    fill(x+hash%6,y+(hash/7)%6,2,1,0x946D4C)
                    fill(x+(hash/17)%7,y+6,1,1,0x503E2E)
                    if !world.isSolid(Cell(cell.x,cell.y-1)) {
                        fill(x,y,8,1,cell.y <= 1 ? 0x8EA760 : 0xB28757)
                        if cell.y <= 1 { fill(x,y+1,8,1,0x657A46) }
                    }
                    if !world.isSolid(Cell(cell.x-1,cell.y)) { fill(x,y,1,8,0x9B734D) }
                    if !world.isSolid(Cell(cell.x,cell.y+1)) { fill(x,y+7,8,1,0x49392C) }
                    if hash%19 == 0 && cell.y > 2 { fill(x+2,y+2,3,2,0xA08A65) }
                    if cell.y < 6 && hash%5 == 0 { fill(x+3,y,1,6,0x59452F); fill(x+4,y+4,2,1,0x59452F) }
                } else if cell.y > 0 {
                    fill(x,y,8,8,hash%3 == 0 ? 0x392B23 : 0x3D2F25)
                    fill(x+hash%7,y+(hash/11)%7,1,1,0x4B392B)
                    if world.isSolid(Cell(cell.x,cell.y-1)) { fill(x,y,8,2,0x2C241E) }
                }
            } }
        }
    }

    private func renderAnts(_ colony: Colony, clock: TimeInterval) {
        let live = Set(colony.ants.map(\.id))
        for id in Array(antNodes.keys) where !live.contains(id) {
            antNodes.removeValue(forKey:id)?.removeFromParent(); carryNodes.removeValue(forKey:id)?.removeFromParent()
        }
        for ant in colony.ants {
            let node: SKSpriteNode
            if let existing = antNodes[ant.id] { node = existing }
            else {
                node = SKSpriteNode(texture:antTextures[ant.caste.rawValue]![0])
                node.size = ant.caste == .queen ? CGSize(width:31,height:18) : ant.caste == .soldier ? CGSize(width:21,height:12) : CGSize(width:18,height:10)
                node.position = point(ant.position)
                antNodes[ant.id] = node; antLayer.addChild(node)
            }
            let goal = point(ant.position)
            node.position.x += (goal.x-node.position.x)*0.55; node.position.y += (goal.y-node.position.y)*0.55
            if let next = ant.route.first {
                let dx = CGFloat(next.x)-CGFloat(ant.position.x), dy = -CGFloat(next.y)+CGFloat(ant.position.y)
                if abs(dx)+abs(dy) > 0.01 { node.zRotation = atan2(dy,dx) }
            }
            let moving = !ant.route.isEmpty && controller?.paused == false
            let frame = moving || ant.task == .digging ? Int(clock*9+Double(ant.id))%4 : Int(clock*2+Double(ant.id))%4
            node.texture = antTextures[ant.caste.rawValue]![frame]
            if ant.carried > 0 {
                let carry: SKSpriteNode
                if let existing = carryNodes[ant.id] { carry = existing }
                else { carry = SKSpriteNode(color:.white,size:CGSize(width:4,height:4)); carryNodes[ant.id] = carry; antLayer.addChild(carry) }
                carry.color = ant.task == .haulingSoil ? UIColor(hex:0xC29A61) : ant.task == .returningWater ? UIColor(hex:0x93CCDA) : UIColor(hex:0xACCF6D)
                carry.position = CGPoint(x:node.position.x+cos(node.zRotation)*10,y:node.position.y+sin(node.zRotation)*10+2)
                carry.isHidden = false
            } else { carryNodes[ant.id]?.isHidden = true }
            if ant.id == controller?.selectedID { ring.position = node.position; ring.isHidden = false }
        }
        if controller?.selectedID == nil { ring.isHidden = true }
    }

    private func renderDetails(_ colony: Colony) {
        resourceLayer.removeAllChildren(); trailLayer.removeAllChildren()
        for patch in colony.world.patches where patch.amount > 0 {
            let base = CGPoint(x:CGFloat(patch.cell.x)*tile,y:-CGFloat(patch.cell.y)*tile+3)
            for i in 0..<min(10,Int(patch.amount/12)+2) {
                let crumb = SKSpriteNode(color:UIColor(hex:patch.kind == .food ? (i%2 == 0 ? 0xB6CC6C : 0xCFAD66) : 0x89C4C6),size:CGSize(width:patch.kind == .food ? 4 : 6,height:3))
                crumb.position = CGPoint(x:base.x+CGFloat(i%4)*4-6,y:base.y+CGFloat(i/4)*3)
                resourceLayer.addChild(crumb)
            }
        }
        for baby in colony.brood {
            let egg = SKSpriteNode(color:UIColor(hex:baby.stage == .egg ? 0xE9DEB3 : baby.stage == .larva ? 0xD3C8A2 : 0xAA8A60),size:CGSize(width:baby.stage == .egg ? 3 : 5,height:3))
            egg.position = CGPoint(x:CGFloat(baby.cell.x)*tile+CGFloat(baby.id%3)*2,y:-CGFloat(baby.cell.y)*tile)
            resourceLayer.addChild(egg)
        }
        if controller?.trails == true {
            for (cell,strength) in colony.world.pheromones where strength > 0.08 {
                let dot = SKSpriteNode(color:UIColor(hex:0xB4CE8A,alpha:min(0.75,CGFloat(strength)*0.4)),size:CGSize(width:5,height:2))
                dot.position = CGPoint(x:CGFloat(cell.x)*tile,y:-CGFloat(cell.y)*tile+3); trailLayer.addChild(dot)
            }
        }
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard touches.count == 1, let touch = touches.first, let view else { return }
        let p = touch.location(in:view); lastTouch = p; touchOrigin = p; dragged = false
    }
    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard event?.allTouches?.count == 1, let touch = touches.first, let view, let last = lastTouch else { return }
        let p = touch.location(in:view)
        if let origin = touchOrigin, hypot(p.x-origin.x,p.y-origin.y)>7 { dragged = true; controller?.following = false }
        if dragged { worldCamera.position.x -= (p.x-last.x)*worldCamera.xScale; worldCamera.position.y += (p.y-last.y)*worldCamera.yScale }
        worldCamera.position.x = max(-23000,min(23000,worldCamera.position.x))
        worldCamera.position.y = max(-23000,min(220,worldCamera.position.y))
        lastTouch = p
    }
    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        defer { lastTouch = nil; touchOrigin = nil }
        guard !dragged, let touch = touches.first, let controller else { return }
        let location = touch.location(in:self)
        if controller.tool != nil { controller.place(at:Int((location.x/tile).rounded())); return }
        let ants = controller.activeSimulation.ants
        let nearby = ants.filter { hypot(point($0.position).x-location.x,point($0.position).y-location.y)<25*worldCamera.xScale }
            .sorted { $0.id < $1.id }
        // Repeated taps cycle through a dense cluster instead of trapping selection on its first ant.
        if let current = nearby.firstIndex(where: { $0.id == controller.selectedID }), !nearby.isEmpty {
            controller.select(nearby[(current+1)%nearby.count].id)
        } else { controller.select(nearby.first?.id) }
    }
    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) { lastTouch = nil; touchOrigin = nil; dragged = true }
}
