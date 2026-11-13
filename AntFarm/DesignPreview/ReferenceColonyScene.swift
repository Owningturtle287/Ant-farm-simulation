import SpriteKit
import UIKit

/// Presentation-only scene. The artwork and inspection values are static fixtures.
final class ReferenceColonyScene: SKScene, UIGestureRecognizerDelegate {
    let world: ReferenceWorld
    var onSelect: ((ReferenceAnt) -> Void)?
    private let worldCamera = SKCameraNode()
    private let selectedRing = SKShapeNode(circleOfRadius: 38)
    private let trailNode = SKNode()
    private var recognizers: [UIGestureRecognizer] = []
    private var selectedID: String?
    private var lastViewport = CGSize.zero
    private var userAdjustedCamera = false

    init(world: ReferenceWorld) {
        self.world = world
        super.init(size: CGSize(width: 844, height: 390))
        scaleMode = .resizeFill
        backgroundColor = UIColor(red: 0.09, green: 0.08, blue: 0.12, alpha: 1)
        let texture = SKTexture(imageNamed: world.image)
        texture.filteringMode = .nearest
        let artwork = SKSpriteNode(texture: texture)
        artwork.size = CGSize(width: world.width, height: world.height)
        artwork.position = CGPoint(x: world.width / 2, y: world.height / 2)
        artwork.zPosition = 0
        addChild(artwork)
        addChild(worldCamera)
        camera = worldCamera
        selectedRing.strokeColor = UIColor(red: 0.91, green: 0.72, blue: 0.42, alpha: 1)
        selectedRing.fillColor = .clear
        selectedRing.lineWidth = 3
        selectedRing.zPosition = 3
        selectedRing.isHidden = true
        addChild(selectedRing)
        buildTrail()
        trailNode.zPosition = 2
        trailNode.isHidden = true
        addChild(trailNode)
        recenter()
    }

    required init?(coder aDecoder: NSCoder) { fatalError("Use init(world:)") }

    override func didMove(to view: SKView) {
        super.didMove(to: view)
        view.isMultipleTouchEnabled = true
        guard recognizers.isEmpty else { return }
        let tap = UITapGestureRecognizer(target: self, action: #selector(tapAnt(_:)))
        let pan = UIPanGestureRecognizer(target: self, action: #selector(panWorld(_:)))
        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinchWorld(_:)))
        tap.require(toFail: pan)
        for recognizer in [tap, pan, pinch] {
            recognizer.delegate = self
            view.addGestureRecognizer(recognizer)
            recognizers.append(recognizer)
        }
        recenter()
    }

    override func willMove(from view: SKView) {
        for recognizer in recognizers { view.removeGestureRecognizer(recognizer) }
        recognizers.removeAll()
        super.willMove(from: view)
    }

    override func didChangeSize(_ oldSize: CGSize) {
        super.didChangeSize(oldSize)
        if size != lastViewport {
            lastViewport = size
            if !userAdjustedCamera { recenter() }
        }
    }

    func select(_ ant: ReferenceAnt) {
        selectedID = ant.id
        selectedRing.position = position(of: ant)
        selectedRing.isHidden = false
    }

    func clearSelection() {
        selectedID = nil
        selectedRing.isHidden = true
    }

    func focus(_ ant: ReferenceAnt) {
        userAdjustedCamera = true
        worldCamera.position = position(of: ant)
        worldCamera.setScale(min(fitScale, 1.5))
        clampCamera()
    }

    func setTrailsVisible(_ visible: Bool) { trailNode.isHidden = !visible }

    func zoom(by factor: CGFloat) {
        userAdjustedCamera = true
        worldCamera.setScale(min(max(worldCamera.xScale * factor, 0.6), fitScale * 1.5))
        clampCamera()
    }

    func recenter() {
        userAdjustedCamera = false
        worldCamera.position = CGPoint(x: world.width / 2, y: world.height / 2)
        worldCamera.setScale(fitScale)
    }

    private var fitScale: CGFloat {
        // Fit the entire concept artwork; extra viewport area uses the scene's ink backdrop.
        max(CGFloat(world.width) / max(size.width, 1), CGFloat(world.height) / max(size.height, 1))
    }

    private func position(of ant: ReferenceAnt) -> CGPoint {
        CGPoint(x: ant.x, y: world.height - ant.y)
    }

    private func buildTrail() {
        for point in world.trail {
            let mark = SKShapeNode(rectOf: CGSize(width: 8, height: 5))
            mark.fillColor = UIColor(red: 0.52, green: 0.74, blue: 0.79, alpha: 0.85)
            mark.strokeColor = .clear
            mark.position = CGPoint(x: point.x, y: world.height - point.y)
            trailNode.addChild(mark)
        }
    }

    private func clampCamera() {
        let halfWidth = size.width * worldCamera.xScale / 2
        let halfHeight = size.height * worldCamera.yScale / 2
        func bounded(_ value: CGFloat, half: CGFloat, extent: CGFloat) -> CGFloat {
            if half * 2 >= extent { return extent / 2 }
            return min(max(value, half), extent - half)
        }
        worldCamera.position.x = bounded(worldCamera.position.x, half: halfWidth, extent: CGFloat(world.width))
        worldCamera.position.y = bounded(worldCamera.position.y, half: halfHeight, extent: CGFloat(world.height))
    }

    @objc private func tapAnt(_ recognizer: UITapGestureRecognizer) {
        guard let view = view else { return }
        let location = recognizer.location(in: view)
        let point = convertPoint(fromView: location)
        guard let nearest = world.ants.min(by: {
            hypot(position(of: $0).x - point.x, position(of: $0).y - point.y)
                < hypot(position(of: $1).x - point.x, position(of: $1).y - point.y)
        }) else { return }
        let antPoint = position(of: nearest)
        let radius = max(48, 28 * worldCamera.xScale)
        if hypot(antPoint.x - point.x, antPoint.y - point.y) <= radius {
            select(nearest)
            onSelect?(nearest)
        }
    }

    @objc private func panWorld(_ recognizer: UIPanGestureRecognizer) {
        guard let view = view else { return }
        userAdjustedCamera = true
        let movement = recognizer.translation(in: view)
        worldCamera.position.x -= movement.x * worldCamera.xScale
        worldCamera.position.y += movement.y * worldCamera.yScale
        recognizer.setTranslation(.zero, in: view)
        clampCamera()
    }

    @objc private func pinchWorld(_ recognizer: UIPinchGestureRecognizer) {
        zoom(by: 1 / recognizer.scale)
        recognizer.scale = 1
    }

    func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer,
                           shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
        gestureRecognizer is UIPinchGestureRecognizer || otherGestureRecognizer is UIPinchGestureRecognizer
    }
}
