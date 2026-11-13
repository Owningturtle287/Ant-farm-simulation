import XCTest

final class PlaythroughTests: XCTestCase {
    @MainActor
    func testFirstClearingControlsAndAntInspection() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .landscapeLeft
        let app = XCUIApplication(); app.launchArguments = ["--smoke-test"]; app.launch()
        XCTAssertTrue(app.buttons["toolColony"].waitForExistence(timeout:15))
        let opening = XCTAttachment(screenshot:app.screenshot()); opening.name = "First clearing"; opening.lifetime = .keepAlways; add(opening)
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
        app.buttons["followAnt"].tap()
        let profile = XCTAttachment(screenshot:app.screenshot()); profile.name = "Individual ant"; profile.lifetime = .keepAlways; add(profile)
        app.buttons["Close ant profile"].tap()
        app.buttons["toolFood"].tap()
        app.coordinate(withNormalizedOffset:CGVector(dx:0.32,dy:0.45)).tap()
        XCTAssertTrue(app.staticTexts["notice"].waitForExistence(timeout:5))
        XCTAssertEqual(app.staticTexts["notice"].label,"Food placed. Let the scouts find it.")
    }
}
