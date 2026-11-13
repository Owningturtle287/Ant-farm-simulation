import XCTest
import UIKit

final class PlaythroughTests: XCTestCase {
    @MainActor
    func testFirstClearingControlsAndAntInspection() throws {
        continueAfterFailure = false
        let app = XCUIApplication(); app.launchArguments = ["--smoke-test"]; app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["toolColony"].waitForExistence(timeout:15))
        XCTAssertGreaterThan(app.frame.width,app.frame.height,"The game window must be landscape.")
        attachLandscape("First clearing")
        app.buttons["pauseButton"].tap()
        XCTAssertEqual(app.buttons["pauseButton"].label,"Resume simulation")
        app.buttons["pauseButton"].tap()
        app.buttons["speedButton"].tap()
        XCTAssertEqual(app.buttons["speedButton"].value as? String,"2 times")
        app.buttons["toolColony"].tap()
        XCTAssertTrue(app.buttons["antRow0"].waitForExistence(timeout:5))
        app.buttons["antRow0"].tap()
        XCTAssertTrue(app.staticTexts["selectedAntName"].waitForExistence(timeout:5))
        XCTAssertEqual(app.staticTexts["selectedAntName"].label,"Queen Aurelia")
        attachLandscape("Individual ant")
        if !app.buttons["followAnt"].isHittable { app.scrollViews.firstMatch.swipeUp() }
        app.buttons["followAnt"].tap()
        app.buttons["toolNest"].tap()
        app.buttons["toolFood"].tap()
        app.coordinate(withNormalizedOffset:CGVector(dx:0.32,dy:0.45)).tap()
        XCTAssertTrue(app.staticTexts["notice"].waitForExistence(timeout:5))
        XCTAssertEqual(app.staticTexts["notice"].label,"Food placed. Let the scouts find it.")
        app.buttons["toolMore"].tap()
        app.buttons["Start a new colony"].tap()
        XCTAssertTrue(app.buttons["Start new colony"].waitForExistence(timeout:5))
        app.buttons["Cancel"].tap()
    }

    @MainActor
    private func attachLandscape(_ name: String) {
        let screen = XCUIScreen.main.screenshot().image
        XCTAssertGreaterThan(screen.size.width,screen.size.height,"The captured screen must be landscape.")
        // Resolve UIImage orientation into actual pixels before XCTest exports PNG data.
        let format = UIGraphicsImageRendererFormat(); format.scale = screen.scale
        let normalized = UIGraphicsImageRenderer(size:screen.size,format:format).image { _ in
            screen.draw(at:.zero)
        }
        XCTAssertGreaterThan(normalized.cgImage!.width,normalized.cgImage!.height)
        let attachment = XCTAttachment(image:normalized)
        attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
    }
}
