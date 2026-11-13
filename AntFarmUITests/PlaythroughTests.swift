import XCTest

final class PlaythroughTests: XCTestCase {
    @MainActor
    func testFirstClearingControlsAndAntInspection() throws {
        continueAfterFailure = false
        let app = XCUIApplication(); app.launchArguments = ["--smoke-test"]; app.launch()
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.buttons["toolColony"].waitForExistence(timeout:15))
        XCTAssertGreaterThan(app.frame.width,app.frame.height,"The game window must be landscape.")
        let initialScreen = XCUIScreen.main.screenshot()
        XCTAssertGreaterThan(initialScreen.image.size.width,initialScreen.image.size.height,"Capture the landscape screen, not portrait application crop bounds.")
        let opening = XCTAttachment(screenshot:initialScreen); opening.name = "First clearing"; opening.lifetime = .keepAlways; add(opening)
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
        let profile = XCTAttachment(screenshot:XCUIScreen.main.screenshot()); profile.name = "Individual ant"; profile.lifetime = .keepAlways; add(profile)
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
}
